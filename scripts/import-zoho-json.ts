/**
 * scripts/import-eedcore.ts
 *
 * Imports EED Core (EEDP-4) from the Zoho fetch output into WinOS.
 *
 * Adapted from scripts/import-zoho-json.ts (Thakre's WinOS import).
 * Key differences for EED Core:
 *   - Phases come from Zoho milestones (not "x.y" task list prefixes)
 *   - One ProjectPhase per milestone; task lists reference their milestone
 *   - Time log phase resolved via task → taskList → milestone chain
 *
 * Prerequisites: run fetch-eedcore-zoho.ts first to create:
 *   scripts/data/eedcoreprojectdata.json
 *   scripts/data/eedcore-task-hierarchy.json
 *
 *   npx tsx scripts/import-zoho-json.ts                       # EED Core (EEDP-4)
 *   npx tsx scripts/import-zoho-json.ts --project EEDP-45     # any other project:
 *     reads scripts/data/<code>-projectdata.json + <code>-task-hierarchy.json
 *   add --dry-run to preview, then roll back
 *
 * Board columns are task lists: "x.y …" lists keep "x.y" as the phase code,
 * others get the initials of their name.
 */

import "dotenv/config";
import * as crypto from "node:crypto";
import * as fs     from "node:fs";
import * as path   from "node:path";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg     } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ adapter } as any) as any;

// --project <CODE> picks the export; EED Core (EEDP-4) keeps its original file names.
const projectArgIdx  = process.argv.indexOf("--project");
const PROJECT_CODE   = projectArgIdx >= 0 ? process.argv[projectArgIdx + 1] : "EEDP-4";
const FILE_PREFIX    = PROJECT_CODE === "EEDP-4" ? "eedcore" : PROJECT_CODE.toLowerCase();
const DATA_FILE      = path.join(__dirname, "data", `${FILE_PREFIX}${PROJECT_CODE === "EEDP-4" ? "" : "-"}projectdata.json`);
const HIERARCHY_FILE = path.join(__dirname, "data", `${FILE_PREFIX}-task-hierarchy.json`);
const DRY_RUN        = process.argv.includes("--dry-run");

const warnings: string[] = [];

// ---------------------------------------------------------------------------
// Types (same ZExport shape as import-zoho-json.ts)
// ---------------------------------------------------------------------------
type ZPerson   = { name: string; email: string };
type ZProject  = { id: string; key: string; name: string; status: string; percent_complete: number | null; start_date: string | null; end_date?: string | null; owner: ZPerson; created_by: ZPerson };
type ZPhase    = { id: string; name: string; status: string; start_date: string | null; end_date: string | null };
type ZTaskList = { id: string; name: string; status?: string; flag?: string; phase_id: string; phase_name: string };
type ZTask     = { id: string; name: string; status: string; tasklist_id: string; tasklist_name: string; milestone_id: string; milestone_name: string; owner: string; owners: (string | Partial<ZPerson>)[]; start_date: string | null; end_date: string | null; priority: string | null; percent_complete: number | null; parent_id: string | null; description: string };
type ZTimeLog  = { date: string; task_name: string; task_code: string; duration_hhmm: string; time_range: string; user: string; billing_type: string; approval_status: string; notes: string; user_email: string; phase: string; task_list: string };
type ZExport   = { project: ZProject; users?: (ZPerson & { role?: string })[]; phases: ZPhase[]; task_lists: ZTaskList[]; tasks: ZTask[]; time_logs: ZTimeLog[] };
type ZHierarchy = { tasks: { id: string; key: string; parent_id: string | null }[] };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function norm(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}
function key(s: string | undefined | null): string {
  return norm(decodeEntities(s)).toLowerCase();
}
function decodeEntities(s: string | undefined | null): string {
  return (s ?? "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");
}
function parseHHMMToMinutes(str: string): number {
  const m = norm(str).match(/^(\d+):(\d+)$/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
/** DD/MM/YYYY → midnight IST */
function parseDDMMYYYY(str: string): Date | null {
  const m = norm(str).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return new Date(`${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00+05:30`);
}
/** Zoho status → WinOS TaskStatus ("Open" | "In Progress" | "Under Review" | "Approved" | "Closed"). */
function mapTaskStatus(s: string): string {
  const k = key(s);
  if (k === "done" || k === "closed") return "Closed";
  if (k === "in progress") return "In Progress";
  if (k === "in review") return "Under Review";
  return "Open"; // Open, On Hold, anything else
}
function mapPriority(s: string | null): string {
  const p = key(s);
  if (!p || p === "none") return "None";
  return p.charAt(0).toUpperCase() + p.slice(1);
}
function mapBillingType(s: string): "BILLABLE" | "NON_BILLABLE" {
  return key(s) === "billable" ? "BILLABLE" : "NON_BILLABLE";
}
function mapApprovalStatus(s: string): "PENDING" | "APPROVED" | "REJECTED" {
  const a = key(s);
  if (a === "approved") return "APPROVED";
  if (a === "rejected") return "REJECTED";
  return "PENDING";
}
function timeLogId(tl: ZTimeLog): string {
  const fingerprint = [key(tl.user_email), norm(tl.date), norm(tl.task_code), norm(tl.time_range), norm(tl.duration_hhmm), norm(tl.notes)].join("|");
  return "zoho-tl-" + crypto.createHash("sha1").update(fingerprint).digest("hex").slice(0, 24);
}

/** Slugify milestone name to a short phase code, e.g. "EED Core Operations" → "ECO" */
function milestoneToCode(name: string, idx: number): string {
  // Try initials (e.g. "HR Department" → "HR", "EED Core Operations" → "ECO")
  const initials = name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .join("");
  return initials || `PH${String(idx + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runImport(tx: any, data: ZExport, hierarchyKeys: Map<string, string>) {
  // Step 1 — Users
  const emails = new Set<string>([
    key(data.project.owner?.email),
    key(data.project.created_by?.email),
    ...data.time_logs.map((tl) => key(tl.user_email)),
    ...data.tasks.flatMap((t) => (t.owners ?? []).map((o) => key(typeof o === "string" ? o : o.email))),
    ...(data.users ?? []).map((u) => key(u.email)),
  ]);
  emails.delete("");
  const users: { id: string; email: string; name: string | null }[] = await tx.user.findMany({
    where: { email: { in: [...emails], mode: "insensitive" } },
    select: { id: true, email: true, name: true },
  });
  const userIdByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  for (const e of emails) {
    if (!userIdByEmail.has(e)) warnings.push(`No WinOS user with email ${e}`);
  }

  // Step 2 — Project
  const p = data.project;
  const projectFields = {
    name:             p.name,
    status:           key(p.status) === "active" ? "ACTIVE" : norm(p.status).toUpperCase() || "ACTIVE",
    progressPercent:  p.percent_complete ?? 0,
    startDate:        p.start_date ?? undefined,
    deadline:         p.end_date ?? undefined,
    ownerId:          userIdByEmail.get(key(p.owner?.email)) ?? null,
    ownerName:        norm(p.owner?.name) || undefined,
    createdByUserId:  userIdByEmail.get(key(p.created_by?.email)) ?? null,
    projectCategory:  "INTERNAL_BUILD" as const,
  };
  const project = await tx.project.upsert({
    where:  { code: PROJECT_CODE },
    update: projectFields,
    create: { code: PROJECT_CODE, ...projectFields },
  });
  console.log(`   ✓ Project: ${project.name} (${project.code})\n`);

  // Step 3/4 — Phases + task lists. As in the WinOS import, a board column is a
  // task list: each Zoho task list gets its own ProjectPhase (code = initials of
  // the list name, e.g. "EED Meetings & Core Things" → "EMCT"). Milestones get no
  // row of their own — several task lists have none ("None" milestone), and
  // milestones without task lists would only be empty columns.
  const phaseIdByCode = new Map<string, string>();  // boardCode → WinOS phase id
  const milestoneStatus = new Map(data.phases.map((ph) => [ph.id, ph.status]));

  const existingPhases: { id: string; code: string }[] = await tx.projectPhase.findMany({
    where: { projectId: project.id },
    select: { id: true, code: true },
  });
  const existingLists: { id: string; name: string }[] = await tx.projectTaskList.findMany({
    where: { projectId: project.id },
    select: { id: true, name: true },
  });
  const taskListByName = new Map<string, { id: string; name: string; boardCode?: string; phaseId?: string }>();

  console.log(`▶  Upserting phases + task lists (one per task list)...`);
  for (const [idx, tl] of data.task_lists.entries()) {
    const name = norm(tl.name);
    // Initials can collide ("Aditya Main Board" / "Arun Main Board" → "AMB"), so
    // later lists get a numeric suffix. Order is the export's, so stable across runs.
    // SOP-style lists ("7.2 Monthly Product Upload") keep their "x.y" prefix as the code.
    // ("7.1.1 Maintenance & Support Open" keeps all three parts.)
    const prefix  = name.match(/^\d+(?:\.\d+)+/);
    const base    = prefix ? prefix[0] : milestoneToCode(name, idx);
    let boardCode = base;
    for (let n = 2; phaseIdByCode.has(boardCode); n++) boardCode = `${base}${prefix ? "-" : ""}${n}`;

    const isCompleted = key(tl.status) === "completed" || key(milestoneStatus.get(tl.phase_id)) === "completed";
    const phaseFields = { name, order: idx, isCompleted };
    const phaseMatch  = existingPhases.find((e) => e.code === boardCode);
    const phase = phaseMatch
      ? await tx.projectPhase.update({ where: { id: phaseMatch.id }, data: phaseFields })
      : await tx.projectPhase.create({ data: { projectId: project.id, code: boardCode, ...phaseFields } });
    phaseIdByCode.set(boardCode, phase.id);

    const fields = { name, phaseCode: boardCode, sequence: idx + 1, flag: tl.flag ?? "internal", status: "Active" };
    const match  = existingLists.find((e) => key(e.name) === key(name));
    const row    = match
      ? await tx.projectTaskList.update({ where: { id: match.id }, data: fields })
      : await tx.projectTaskList.create({ data: { projectId: project.id, ...fields } });

    taskListByName.set(key(name), { id: row.id, name, boardCode, phaseId: phase.id });
    console.log(`   ${phaseMatch ? "·" : "+"} [${boardCode}] ${name}`);
  }
  // Zoho milestones with no task list of their own still get a (task-less) phase,
  // so every Zoho phase exists in WinOS.
  const milestonesWithLists = new Set(data.task_lists.map((tl) => tl.phase_id));
  for (const [i, ph] of data.phases.filter((m) => !milestonesWithLists.has(m.id)).entries()) {
    const name    = norm(ph.name);
    const base    = milestoneToCode(name, i);
    let boardCode = base;
    for (let n = 2; phaseIdByCode.has(boardCode); n++) boardCode = `${base}${n}`;

    const phaseFields = { name, order: data.task_lists.length + i, isCompleted: key(ph.status) === "completed" };
    const phaseMatch  = existingPhases.find((e) => e.code === boardCode);
    const phase = phaseMatch
      ? await tx.projectPhase.update({ where: { id: phaseMatch.id }, data: phaseFields })
      : await tx.projectPhase.create({ data: { projectId: project.id, code: boardCode, ...phaseFields } });
    phaseIdByCode.set(boardCode, phase.id);
    console.log(`   ${phaseMatch ? "·" : "+"} [${boardCode}] ${name} (milestone, no task list)`);
  }
  const obsoletePhaseIds = existingPhases.filter((e) => !phaseIdByCode.has(e.code)).map((e) => e.id);
  console.log();

  // Step 5 — Task key resolution (from hierarchy file)
  const zohoKeyByTaskId = new Map<string, string>(hierarchyKeys);

  // Step 6 — Match existing tasks by zoho: tag
  const existingTasks: { id: string; tags: string[] }[] = await tx.projectTask.findMany({
    where: { projectId: project.id },
    select: { id: true, tags: true },
  });
  const existingTaskIdByZohoId = new Map<string, string>();
  for (const t of existingTasks) {
    const tag = t.tags.find((x) => x.startsWith("zoho:"));
    if (tag) existingTaskIdByZohoId.set(tag.slice("zoho:".length), t.id);
  }

  const winosIdByZohoId = new Map<string, string>();
  const orderInList     = new Map<string, number>();
  let ownersAssigned    = 0;
  const taskOwnerUserIds = new Set<string>();

  async function upsertTask(t: ZTask, parentTaskId: string | null) {
    const list      = taskListByName.get(key(t.tasklist_name));
    const boardCode = list?.boardCode;
    const order     = orderInList.get(list?.id ?? "") ?? 0;
    orderInList.set(list?.id ?? "", order + 1);

    const code = zohoKeyByTaskId.get(t.id) ?? `${PROJECT_CODE}-Z${t.id.slice(-6)}`;

    const owners = (t.owners ?? [])
      .map((o) => (typeof o === "string" ? { email: o, name: "" } : { email: o.email ?? "", name: o.name ?? "" }))
      .map((o) => ({ ...o, userId: userIdByEmail.get(key(o.email)) }))
      .filter((o): o is { email: string; name: string; userId: string } => !!o.userId);
    const ownerIds = [...new Set(owners.map((o) => o.userId))];

    const fields = {
      code,
      title:               norm(decodeEntities(t.name)),
      order,
      projectId:           project.id,
      phaseId:             list?.phaseId   ?? null,
      phaseCode:           boardCode       ?? null,
      phaseName:           list ? list.name.toUpperCase() : null,
      taskListId:          list?.id        ?? null,
      taskListName:        list?.name      ?? null,
      status:              mapTaskStatus(t.status),
      priority:            mapPriority(t.priority),
      completionPercentage: t.percent_complete ?? (mapTaskStatus(t.status) === "Closed" ? 100 : 0),
      startDate:           t.start_date ?? "--",
      dueDate:             t.end_date   ?? "--",
      description:         t.description || null,
      parentTaskId,
      tags:                [`zoho:${t.id}`],
      ownerId:             ownerIds[0] ?? null,
      owner:               ownerIds.length ? norm(owners[0].name) || norm(t.owner) : "Unassigned",
    };

    const existingId = existingTaskIdByZohoId.get(t.id);
    const row = existingId
      ? await tx.projectTask.update({ where: { id: existingId }, data: fields })
      : await tx.projectTask.create({ data: fields });
    winosIdByZohoId.set(t.id, row.id);

    // Owners — replace, so owners removed in Zoho are dropped on re-runs. Two
    // queries per task regardless of owner count (the DB is remote; round trips dominate).
    if (existingId) {
      await tx.projectTaskOwner.deleteMany({ where: { taskId: row.id, userId: { notIn: ownerIds } } });
    }
    if (ownerIds.length) {
      await tx.projectTaskOwner.createMany({
        data: ownerIds.map((userId) => ({ taskId: row.id, userId })),
        skipDuplicates: true,
      });
    }
    ownersAssigned += ownerIds.length;
    ownerIds.forEach((id) => taskOwnerUserIds.add(id));
  }

  // Step 7 — Root tasks
  console.log(`▶  Upserting tasks (topological order)...`);
  const roots   = data.tasks.filter((t) => t.parent_id === null);
  const nonRoot = data.tasks.filter((t) => t.parent_id !== null);
  for (const t of roots) await upsertTask(t, null);
  console.log(`   Root tasks: ${roots.length}`);

  // Subtasks — loop until all parents are inserted
  let pending   = nonRoot;
  let subCount  = 0;
  while (pending.length) {
    const ready = pending.filter((t) => winosIdByZohoId.has(t.parent_id!));
    if (!ready.length) {
      for (const t of pending) {
        warnings.push(`Subtask "${t.name}" (${t.id}): parent ${t.parent_id} not found — imported as root`);
        await upsertTask(t, null);
      }
      break;
    }
    for (const t of ready) await upsertTask(t, winosIdByZohoId.get(t.parent_id!)!);
    subCount  += ready.length;
    pending    = pending.filter((t) => !ready.includes(t));
  }
  console.log(`   Subtasks:   ${subCount}\n`);

  // Project users (ProjectMember) — the Project Users tab lists these.
  // With Zoho's project user list in the export (`users`), WinOS mirrors it exactly:
  // Administrators and the owner are "Project Manager", everyone else "Team Member".
  // Without it (the Zoho connector can't read project users), fall back to the
  // owner + every task owner, and leave existing rows alone.
  let members: { userId: string; projectRole: string }[];
  if (data.users?.length) {
    const seen = new Set<string>();
    members = [];
    for (const u of data.users) {
      const userId = userIdByEmail.get(key(u.email));
      if (!userId) { warnings.push(`Project user ${u.email} not in WinOS — skipped`); continue; }
      if (seen.has(userId)) continue;
      seen.add(userId);
      const isManager = userId === projectFields.ownerId || key(u.role) === "administrator";
      members.push({ userId, projectRole: isManager ? "Project Manager" : "Team Member" });
    }
    await tx.projectMember.deleteMany({ where: { projectId: project.id, userId: { notIn: [...seen] } } });
    for (const role of ["Project Manager", "Team Member"]) {
      const ids = members.filter((m) => m.projectRole === role).map((m) => m.userId);
      if (ids.length) await tx.projectMember.updateMany({ where: { projectId: project.id, userId: { in: ids } }, data: { projectRole: role } });
    }
  } else {
    members = [
      ...(projectFields.ownerId ? [{ userId: projectFields.ownerId, projectRole: "Project Manager" }] : []),
      ...[...taskOwnerUserIds]
        .filter((id) => id !== projectFields.ownerId)
        .map((userId) => ({ userId, projectRole: "Team Member" })),
    ];
  }
  const { count: membersAdded } = await tx.projectMember.createMany({
    data: members.map((m) => ({ projectId: project.id, ...m })),
    skipDuplicates: true,
  });
  console.log(`▶  Project users: ${members.length} (${membersAdded} new${data.users?.length ? ", from Zoho's project user list" : ", from task owners"})\n`);

  // Step 8 — Time logs
  // Build code → {taskId, phaseId} map for log resolution
  const taskIdByCode = new Map<string, { taskId: string; phaseId: string | null }>();
  for (const [zohoId, zohoKey] of zohoKeyByTaskId) {
    const t    = data.tasks.find((x) => x.id === zohoId);
    if (!t)   continue;
    const list = taskListByName.get(key(t.tasklist_name));
    taskIdByCode.set(zohoKey, { taskId: winosIdByZohoId.get(zohoId)!, phaseId: list?.phaseId ?? null });
  }

  console.log(`▶  Inserting time logs...`);
  const skippedByReason = new Map<string, number>();
  const skip = (reason: string) => skippedByReason.set(reason, (skippedByReason.get(reason) ?? 0) + 1);

  const rows = [];
  for (const tl of data.time_logs) {
    const userId = userIdByEmail.get(key(tl.user_email));
    if (!userId) { skip(`no user ${key(tl.user_email)}`); continue; }

    const task = taskIdByCode.get(norm(tl.task_code));
    if (!task) { skip(`task code "${norm(tl.task_code)}" not in export`); continue; }

    // Phase: prefer task's own phase, then look up from task_list name
    const phaseId = task.phaseId ?? (() => {
      const list = taskListByName.get(key(tl.task_list));
      return list?.phaseId ?? null;
    })();
    if (!phaseId) { skip(`phase for task list "${norm(tl.task_list)}" not found`); continue; }

    const date = parseDDMMYYYY(tl.date);
    if (!date) { skip(`unparseable date "${tl.date}"`); continue; }

    rows.push({
      id:             timeLogId(tl),
      projectId:      project.id,
      phaseId,
      taskId:         task.taskId,
      userId,
      date,
      duration:       parseHHMMToMinutes(tl.duration_hhmm),
      billingType:    mapBillingType(tl.billing_type),
      approvalStatus: mapApprovalStatus(tl.approval_status),
      description:    norm(tl.notes) || null,
    });
  }
  for (const [reason, n] of skippedByReason) warnings.push(`Time logs skipped (${n}): ${reason}`);

  const uniqueIds = new Set(rows.map((r) => r.id));
  if (uniqueIds.size < rows.length) {
    warnings.push(`${rows.length - uniqueIds.size} time log(s) are duplicates within the export — collapsed`);
  }
  const { count: timeLogsInserted } = await tx.projectTimeLog.createMany({ data: rows, skipDuplicates: true });
  console.log(`   Inserted: ${timeLogsInserted} (${rows.length} attempted)\n`);

  // Drop phases from an older import layout (the milestone phases "ECO", "GEN", …).
  // Time logs and active timers cascade-delete with their phase, so a phase
  // anything still points at is left in place instead.
  let phasesRemoved = 0;
  for (const id of obsoletePhaseIds) {
    const [logs, timers] = await Promise.all([
      tx.projectTimeLog.count({ where: { phaseId: id } }),
      tx.activeTimer.count({ where: { phaseId: id } }),
    ]);
    if (logs || timers) {
      warnings.push(`Old phase ${id} still has ${logs} time log(s) / ${timers} active timer(s) — not deleted`);
      continue;
    }
    await tx.projectPhase.delete({ where: { id } });
    phasesRemoved++;
  }

  return {
    projectId:           project.id,
    phases:              phaseIdByCode.size,
    phasesRemoved,
    taskLists:           taskListByName.size,
    rootTasks:           roots.length,
    subtasks:            subCount,
    tasksWithZohoCode:   zohoKeyByTaskId.size,
    taskOwnersAssigned:  ownersAssigned,
    projectUsers:        members.length,
    timeLogsInExport:    data.time_logs.length,
    timeLogsInserted,
    timeLogsAlreadyPresent: uniqueIds.size - timeLogsInserted,
  };
}

// ---------------------------------------------------------------------------
class DryRunRollback extends Error {}

async function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌  Missing: ${DATA_FILE}\n   Run: npx tsx scripts/fetch-eedcore-zoho.ts`);
    process.exit(1);
  }

  const data: ZExport = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  if (data.project.key !== PROJECT_CODE) {
    throw new Error(`Export is for project ${data.project.key}, expected ${PROJECT_CODE}`);
  }
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  ${data.project.name} (${PROJECT_CODE}) → WinOS Import${DRY_RUN ? " [DRY RUN]" : ""}`);
  console.log(`═══════════════════════════════════════════════════`);
  console.log(`  tasks: ${data.tasks.length} | task_lists: ${data.task_lists.length} | phases: ${data.phases.length} | time_logs: ${data.time_logs.length}\n`);

  // Restore task tree + Zoho keys from hierarchy file
  const hierarchyKeys = new Map<string, string>();
  if (fs.existsSync(HIERARCHY_FILE)) {
    const hierarchy: ZHierarchy = JSON.parse(fs.readFileSync(HIERARCHY_FILE, "utf-8"));
    const byId = new Map(hierarchy.tasks.map((h) => [h.id, h]));
    for (const t of data.tasks) {
      const h = byId.get(t.id);
      if (!h) {
        warnings.push(`Task "${t.name}" (${t.id}) not in hierarchy — root task, key from fallback`);
        continue;
      }
      t.parent_id = h.parent_id;           // override the JSON's parent_id (may already be set)
      if (h.key) hierarchyKeys.set(t.id, h.key);
    }
    console.log(`  Hierarchy: ${byId.size} entries (${hierarchyKeys.size} with keys)\n`);
  } else {
    warnings.push(`${HIERARCHY_FILE} not found — no subtasks linked, keys use fallback format`);
  }

  let summary: Awaited<ReturnType<typeof runImport>> | undefined;
  try {
    await db.$transaction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (tx: any) => {
        summary = await runImport(tx, data, hierarchyKeys);
        if (DRY_RUN) throw new DryRunRollback();
      },
      { timeout: 60 * 60_000, maxWait: 60_000 },
    );
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
  }

  console.log(DRY_RUN ? "=== DRY RUN — rolled back, nothing written ===" : "=== IMPORT COMPLETE ===");
  console.table(summary);
  if (warnings.length) {
    console.log(`\nWARNINGS (${warnings.length}):`);
    for (const w of warnings) console.log("  ⚠  " + w);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());