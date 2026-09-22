// ONE-TIME IMPORT — Archive after running
//
// Imports the WinOS Zoho Projects export (tasks + timesheet) into the real
// Project/ProjectPhase/ProjectTaskList/ProjectTask/ProjectTaskOwner/ProjectTimeLog
// tables. Safe to re-run for tasks (upserted); time logs are deduped on
// [userId, taskId, date, duration] before insert.
//
// Deviations from the original spec, made to match prisma/schema.prisma:
//   - Project/ProjectPhase/ProjectTaskList/ProjectTask have no @@unique on
//     code/name in the schema, so those are upserted manually via
//     findFirst + create/update instead of db.upsert(). ProjectTaskOwner DOES
//     have @@unique([taskId, userId]) so a real upsert is used there.
//   - ProjectTimeLog.duration is `Int // minutes` in the schema (not
//     seconds), so HH:MM is converted to minutes.
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ adapter } as any) as any;

const DATA_DIR = path.join(__dirname, "data");
const TASK_CSV = path.join(DATA_DIR, "task_export.csv");
const TIMESHEET_CSV = path.join(DATA_DIR, "timesheet.csv");

const warnings: string[] = [];
const errors: string[] = [];

// ---------------------------------------------------------------------------
// CSV parsing (RFC4180-ish: handles quoted fields with embedded commas,
// newlines, and doubled quotes — the Zoho exports have all three).
// ---------------------------------------------------------------------------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function readCsv(filePath: string): string[][] {
  const text = fs.readFileSync(filePath, "utf-8");
  return parseCsv(text);
}

function norm(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function isEmptyRow(row: string[]): boolean {
  return row.every((c) => norm(c) === "");
}

// ---------------------------------------------------------------------------
// User lookup
// ---------------------------------------------------------------------------
type UserRow = { id: string; name: string | null; email: string };

function buildUserMaps(users: UserRow[]) {
  const nameMap = new Map<string, string>();
  const firstNameMap = new Map<string, string[]>();
  const emailMap = new Map<string, string>();

  for (const u of users) {
    emailMap.set(u.email.toLowerCase(), u.id);
    if (!u.name) continue;
    const fullName = norm(u.name).toLowerCase();
    nameMap.set(fullName, u.id);
    const first = fullName.split(" ")[0];
    const bucket = firstNameMap.get(first) || [];
    bucket.push(u.id);
    firstNameMap.set(first, bucket);
  }
  return { nameMap, firstNameMap, emailMap };
}

// The Zoho display names in the task export don't always match the stored
// WinOS User.name (e.g. Ishita's User.name is null, "M Thakre" is stored as
// "M.Thakre", "Dhruv Patidar" as "Dhruv") — see the "User email reference"
// table in the import spec. Resolve these known identities by email first.
const ZOHO_NAME_EMAIL_OVERRIDES: Record<string, string> = {
  "rudraram vamshivardhan reddy": "uiux@eagleeyedigital.io",
  "ishita vishwakarma": "ishita.vishwakarma@eagleeyedigital.io",
  "m thakre": "m.thakre@eagleeyedigital.io",
  "dhruv patidar": "wp@eagleeyedigital.io",
};

function matchUserByName(
  name: string | undefined | null,
  maps: ReturnType<typeof buildUserMaps>,
  context: string
): string | undefined {
  const n = norm(name);
  if (!n || n.toLowerCase() === "unassigned user") return undefined;

  const overrideEmail = ZOHO_NAME_EMAIL_OVERRIDES[n.toLowerCase()];
  if (overrideEmail) {
    const byOverride = maps.emailMap.get(overrideEmail);
    if (byOverride) return byOverride;
  }

  const exact = maps.nameMap.get(n.toLowerCase());
  if (exact) return exact;

  const first = n.toLowerCase().split(" ")[0];
  const candidates = maps.firstNameMap.get(first);
  if (candidates && candidates.length === 1) return candidates[0];
  if (candidates && candidates.length > 1) {
    warnings.push(`${context}: ambiguous first-name match for "${name}" (${candidates.length} users) — skipped`);
    return undefined;
  }

  warnings.push(`${context}: no user found for "${name}" — skipped`);
  return undefined;
}

function matchUserByEmail(
  email: string | undefined | null,
  maps: ReturnType<typeof buildUserMaps>
): string | undefined {
  const e = norm(email).toLowerCase();
  if (!e) return undefined;
  return maps.emailMap.get(e);
}

// ---------------------------------------------------------------------------
// Value mappers
// ---------------------------------------------------------------------------
function parseHHMMToMinutes(str: string): number {
  const m = norm(str).match(/^(\d+):(\d+)$/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function parseDDMMYYYY(str: string): Date | null {
  const m = norm(str).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return new Date(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10));
}

function mapBillingType(str: string): "BILLABLE" | "NON_BILLABLE" {
  return norm(str) === "Billable" ? "BILLABLE" : "NON_BILLABLE";
}

function mapApprovalStatus(str: string): "PENDING" | "APPROVED" | "REJECTED" {
  const s = norm(str);
  if (s === "Approved") return "APPROVED";
  if (s === "Rejected") return "REJECTED";
  return "PENDING";
}

function mapTaskStatus(str: string): string {
  const s = norm(str);
  if (s === "Done") return "Closed";
  if (s === "Open") return "Open";
  return "Open";
}

const PHASE_ORDER: Record<string, number> = {
  "Client Onboarding and Requirement Gathering": 1,
  "Research and Planning": 2,
  "Product Design": 3,
  "Product Development": 4,
  Testing: 5,
  "Deployment and SEO": 6,
  "Maintenance and Support": 7,
};

function slugify(str: string): string {
  return norm(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ---------------------------------------------------------------------------
// Manual upsert helpers (no @@unique on these fields in the schema)
// ---------------------------------------------------------------------------
async function upsertPhase(projectId: string, name: string, data: Record<string, unknown>) {
  const existing = await db.projectPhase.findFirst({ where: { projectId, name } });
  if (existing) {
    return db.projectPhase.update({ where: { id: existing.id }, data });
  }
  return db.projectPhase.create({ data: { projectId, name, ...data } });
}

async function upsertTaskList(projectId: string, name: string, data: Record<string, unknown>) {
  const existing = await db.projectTaskList.findFirst({ where: { projectId, name } });
  if (existing) {
    return db.projectTaskList.update({ where: { id: existing.id }, data });
  }
  return db.projectTaskList.create({ data: { projectId, name, ...data } });
}

async function upsertTask(code: string, data: Record<string, unknown>) {
  const existing = await db.projectTask.findFirst({ where: { code } });
  if (existing) {
    return db.projectTask.update({ where: { id: existing.id }, data });
  }
  return db.projectTask.create({ data: { code, ...data } });
}

// ---------------------------------------------------------------------------
// Phase 1 — Tasks
// ---------------------------------------------------------------------------
async function importTasks(maps: ReturnType<typeof buildUserMaps>) {
  const rows = readCsv(TASK_CSV);
  const header = rows[0];
  const idx = (col: string) => header.indexOf(col);
  const dataRows = rows.slice(1).filter((r) => norm(r[idx("Task Name")]) !== "" && norm(r[idx("Task ID")]) !== "");

  const col = {
    taskName: idx("Task Name"),
    owner: idx("Owner"),
    customStatus: idx("Custom Status"),
    priority: idx("Priority"),
    createdBy: idx("Created By"),
    percentCompleted: idx("% Completed"),
    startDate: idx("Start Date"),
    dueDate: idx("Due Date"),
    taskDescription: idx("Task Description"),
    taskId: idx("Task ID"),
    taskListName: idx("Task List Name"),
    phaseName: idx("Phase Name"),
    phaseOwner: idx("Phase Owner"),
    phaseFlag: idx("Phase Flag"),
    phaseStatus: idx("Phase Status"),
    projectId: idx("Project ID"),
    projectName: idx("Project Name"),
    projectStatus: idx("Project Status"),
    projectOwner: idx("Project Owner"),
    projectStartDate: idx("Project Start Date"),
    projectEndDate: idx("Project End Date"),
  };

  const first = dataRows[0];

  // Step 2 — Project
  const project = await db.project.upsert({
    where: { code: first[col.projectId] },
    update: {
      name: first[col.projectName],
      status: norm(first[col.projectStatus]) || undefined,
      startDate: norm(first[col.projectStartDate]) || undefined,
      deadline: norm(first[col.projectEndDate]) || undefined,
      ownerId: matchUserByName(first[col.projectOwner], maps, "Project.ownerId"),
    },
    create: {
      code: first[col.projectId],
      name: first[col.projectName],
      status: norm(first[col.projectStatus]) || "Active",
      startDate: norm(first[col.projectStartDate]) || undefined,
      deadline: norm(first[col.projectEndDate]) || undefined,
      ownerId: matchUserByName(first[col.projectOwner], maps, "Project.ownerId"),
    },
  });

  // Step 3 — Phases
  const phaseNames = new Set(dataRows.map((r) => norm(r[col.phaseName])).filter(Boolean));
  const phaseByName = new Map<string, { id: string; code: string; order: number }>();
  for (const phaseName of phaseNames) {
    const row = dataRows.find((r) => norm(r[col.phaseName]) === phaseName)!;
    const order = PHASE_ORDER[phaseName] ?? 0;
    const code = slugify(phaseName);
    const phase = await upsertPhase(project.id, phaseName, {
      code,
      order,
      isCompleted: norm(row[col.phaseStatus]) === "Completed",
      ownerId: matchUserByName(row[col.phaseOwner], maps, `ProjectPhase[${phaseName}].ownerId`),
    });
    phaseByName.set(phaseName, { id: phase.id, code, order });
  }
  const codeByOrder = new Map<number, string>();
  for (const p of phaseByName.values()) codeByOrder.set(p.order, p.code);

  // Step 4 — Task lists
  const taskListNames = new Set(dataRows.map((r) => norm(r[col.taskListName])).filter(Boolean));
  const taskListByName = new Map<string, { id: string }>();
  for (const taskListName of taskListNames) {
    const row = dataRows.find((r) => norm(r[col.taskListName]) === taskListName)!;
    const leadingMatch = taskListName.match(/^(\d+)\.(\d+)/);
    const leadingPhaseNum = leadingMatch ? parseInt(leadingMatch[1], 10) : 0;
    const sequence = leadingMatch ? parseInt(leadingMatch[2], 10) : 1;
    const taskList = await upsertTaskList(project.id, taskListName, {
      phaseCode: codeByOrder.get(leadingPhaseNum),
      flag: norm(row[col.phaseFlag]) || "external",
      status: norm(row[col.phaseStatus]) || "Active",
      sequence,
    });
    taskListByName.set(taskListName, { id: taskList.id });
  }

  // Step 5 — Tasks
  const taskCodeToId = new Map<string, string>();
  let taskCount = 0;
  for (const r of dataRows) {
    const code = norm(r[col.taskId]);
    if (!code) continue;

    const phaseName = norm(r[col.phaseName]);
    const taskListName = norm(r[col.taskListName]);
    const startDate = norm(r[col.startDate]);
    const dueDate = norm(r[col.dueDate]);

    const ownerRaw = norm(r[col.owner]);
    const primaryOwnerName = ownerRaw.split(",")[0]?.trim();

    try {
      const task = await upsertTask(code, {
        projectId: project.id,
        phaseId: phaseByName.get(phaseName)?.id,
        taskListId: taskListByName.get(taskListName)?.id,
        title: r[col.taskName],
        status: mapTaskStatus(r[col.customStatus]),
        priority: norm(r[col.priority]) || undefined,
        completionPercentage: parseInt(norm(r[col.percentCompleted]) || "0", 10) || 0,
        startDate: startDate && startDate !== "-" ? startDate : undefined,
        dueDate: dueDate && dueDate !== "-" ? dueDate : undefined,
        description: norm(r[col.taskDescription]) || undefined,
        authorId: matchUserByName(r[col.createdBy], maps, `ProjectTask[${code}].authorId`),
        ownerId: matchUserByName(primaryOwnerName, maps, `ProjectTask[${code}].ownerId`),
      });
      taskCodeToId.set(code, task.id);
      taskCount++;

      // Step 6 — Task owners (real upsert: ProjectTaskOwner has @@unique([taskId, userId]))
      if (ownerRaw && ownerRaw.toLowerCase() !== "unassigned user") {
        for (const ownerNameRaw of ownerRaw.split(",")) {
          const ownerName = ownerNameRaw.trim();
          if (!ownerName || ownerName.toLowerCase() === "unassigned user") continue;
          const userId = matchUserByName(ownerName, maps, `ProjectTaskOwner[${code}]`);
          if (!userId) continue;
          await db.projectTaskOwner.upsert({
            where: { taskId_userId: { taskId: task.id, userId } },
            update: {},
            create: { taskId: task.id, userId },
          });
        }
      }
    } catch (e) {
      errors.push(`Task ${code}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    project,
    phaseCount: phaseByName.size,
    taskListCount: taskListByName.size,
    taskCount,
    phaseIdByName: new Map([...phaseByName].map(([name, p]) => [name, p.id])),
    taskCodeToId,
  };
}

// ---------------------------------------------------------------------------
// Phase 2 — Time logs
// ---------------------------------------------------------------------------
async function importTimeLogs(
  maps: ReturnType<typeof buildUserMaps>,
  projectId: string,
  phaseIdByName: Map<string, string>,
  taskCodeToId: Map<string, string>
) {
  const rows = readCsv(TIMESHEET_CSV);
  const headerIndex = rows.findIndex((r) => norm(r[0]) === "Date");
  if (headerIndex === -1) {
    errors.push("Timesheet CSV: could not find header row (column 'Date')");
    return 0;
  }
  const header = rows[headerIndex];
  const idx = (col: string) => header.indexOf(col);

  const col = {
    date: idx("Date"),
    taskBugsId: idx("Task/Bugs ID"),
    dailyLog: idx("Daily Log"),
    user: idx("User"),
    billingType: idx("Billing Type"),
    approvalStatus: idx("Approval Status"),
    notes: idx("Notes"),
    logUserMailid: idx("Log User Mailid"),
    phase: idx("phase"),
  };

  let created = 0;
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || isEmptyRow(r)) continue;
    if (norm(r[2]) === "Total Log Hours") continue; // trailing summary row
    if (!norm(r[col.date])) continue;

    const date = parseDDMMYYYY(r[col.date]);
    if (!date) {
      warnings.push(`Time log row ${i + 1}: unparseable date "${r[col.date]}" — skipped`);
      continue;
    }

    const userId = matchUserByEmail(r[col.logUserMailid], maps) ?? matchUserByName(r[col.user], maps, `TimeLog row ${i + 1}`);
    if (!userId) {
      warnings.push(`Time log row ${i + 1}: no user found for "${r[col.user]}" <${r[col.logUserMailid]}> — skipped`);
      continue;
    }

    const taskCode = norm(r[col.taskBugsId]);
    const taskId = taskCodeToId.get(taskCode);
    if (!taskId) {
      warnings.push(`Time log row ${i + 1}: task "${taskCode}" not found — skipped`);
      continue;
    }

    const phaseName = norm(r[col.phase]);
    const phaseId = phaseIdByName.get(phaseName);
    if (!phaseId) {
      warnings.push(`Time log row ${i + 1}: phase "${phaseName}" not found — skipped`);
      continue;
    }

    const duration = parseHHMMToMinutes(r[col.dailyLog]);

    const dup = await db.projectTimeLog.findFirst({
      where: { userId, taskId, date, duration },
    });
    if (dup) continue;

    try {
      await db.projectTimeLog.create({
        data: {
          projectId,
          phaseId,
          taskId,
          userId,
          date,
          duration,
          billingType: mapBillingType(r[col.billingType]),
          approvalStatus: mapApprovalStatus(r[col.approvalStatus]),
          description: norm(r[col.notes]) || null,
        },
      });
      created++;
    } catch (e) {
      errors.push(`Time log row ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return created;
}

// ---------------------------------------------------------------------------
async function main() {
  const users: UserRow[] = await db.user.findMany({ select: { id: true, name: true, email: true } });
  const maps = buildUserMaps(users);

  const { project, phaseCount, taskListCount, taskCount, phaseIdByName, taskCodeToId } = await importTasks(maps);

  const ownerCount = await db.projectTaskOwner.count({ where: { task: { projectId: project.id } } });

  const timeLogCount = await importTimeLogs(maps, project.id, phaseIdByName, taskCodeToId);

  console.log("=== IMPORT COMPLETE ===");
  console.log(`Project upserted: 1`);
  console.log(`Phases upserted: ${phaseCount}`);
  console.log(`Task lists upserted: ${taskListCount}`);
  console.log(`Tasks upserted: ${taskCount}`);
  console.log(`Task owners upserted: ${ownerCount}`);
  console.log(`Time logs created: ${timeLogCount}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Errors: ${errors.length}`);
  if (warnings.length) console.log("WARNINGS:", warnings);
  if (errors.length) console.log("ERRORS:", errors);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
