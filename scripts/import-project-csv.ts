// ONE-TIME IMPORT — Archive after running
//
// Imports scripts/data/{Project,ProjectPhase,ProjectTaskList,ProjectTask,
// ProjectTaskOwner,ProjectMember,ProjectTimeLog}.csv into the DB pointed at
// by DATABASE_URL. These CSVs are a direct table dump (real cuids already
// assigned, relations already resolved) — NOT the Zoho export format used by
// import-zoho.ts.
//
// Safety: every row is upserted by its own `id`. A row is only ever created
// (if that id doesn't exist yet) or updated in place (if it does) — nothing
// else in the target DB is read, deleted, or touched. Rows whose FK targets
// (User ids) don't exist in the target DB are skipped with a warning rather
// than failing the whole run. Safe to re-run.
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ adapter } as any) as any;

const DATA_DIR = path.join(__dirname, "data");

const warnings: string[] = [];
const errors: string[] = [];

// ---------------------------------------------------------------------------
// CSV parsing (RFC4180-ish: handles quoted fields with embedded commas,
// newlines, and doubled quotes).
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

function readTable(fileName: string): Record<string, string>[] {
  const filePath = path.join(DATA_DIR, fileName);
  const rows = parseCsv(fs.readFileSync(filePath, "utf-8"));
  const header = rows[0];
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function s(v: string | undefined): string | undefined {
  return v && v !== "" ? v : undefined;
}
function n(v: string | undefined): number | undefined {
  const t = s(v);
  return t !== undefined ? Number(t) : undefined;
}
function b(v: string | undefined): boolean | undefined {
  const t = s(v);
  return t === undefined ? undefined : t === "true";
}
function d(v: string | undefined): Date | undefined {
  const t = s(v);
  return t !== undefined ? new Date(t.replace(" ", "T")) : undefined;
}
function tags(v: string | undefined): string[] {
  const t = s(v);
  if (!t) return [];
  try {
    const parsed = JSON.parse(t);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
async function main() {
  const existingUsers: { id: string }[] = await db.user.findMany({ select: { id: true } });
  const userIds = new Set(existingUsers.map((u) => u.id));
  const validUser = (id: string | undefined, context: string): string | undefined => {
    if (!id) return undefined;
    if (userIds.has(id)) return id;
    warnings.push(`${context}: userId "${id}" not found in target DB — left unset`);
    return undefined;
  };

  const counts = { project: 0, phase: 0, taskList: 0, task: 0, taskOwner: 0, member: 0, timeLog: 0 };

  // 1. Project
  for (const r of readTable("Project.csv")) {
    try {
      const data = {
        name: r.name,
        description: s(r.description),
        startDate: s(r.startDate),
        ownerId: validUser(s(r.ownerId), `Project[${r.id}].ownerId`),
        associatedTeam: s(r.associatedTeam),
        billableHours: s(r.billableHours) ?? "00:00 h",
        billingType: s(r.billingType),
        code: s(r.code),
        deadline: s(r.deadline),
        nonBillableHours: s(r.nonBillableHours) ?? "00:00 h",
        ownerAvatarColor: s(r.ownerAvatarColor),
        ownerInitials: s(r.ownerInitials),
        ownerName: s(r.ownerName),
        priority: s(r.priority) ?? "None",
        progressPercent: n(r.progressPercent) ?? 0,
        reminder: s(r.reminder),
        tags: tags(r.tags),
        totalHours: s(r.totalHours) ?? "00:00 h",
        status: s(r.status) ?? "Active",
        createdByUserId: validUser(s(r.createdByUserId), `Project[${r.id}].createdByUserId`),
        departmentAlias: s(r.departmentAlias),
        isClientVisible: b(r.isClientVisible) ?? true,
        projectCategory: s(r.projectCategory),
        templateUsed: s(r.templateUsed),
        businessHours: s(r.businessHours),
        group: s(r.group),
        taskLayout: s(r.taskLayout),
        accessType: s(r.accessType) ?? "PUBLIC",
        creativeNotes: s(r.creativeNotes),
        designLink: s(r.designLink),
        driveLink: s(r.driveLink),
        marketingNotes: s(r.marketingNotes),
        techNotes: s(r.techNotes),
        webLink: s(r.webLink),
      };
      await db.project.upsert({
        where: { id: r.id },
        update: data,
        create: { id: r.id, ...data },
      });
      counts.project++;
    } catch (e) {
      errors.push(`Project[${r.id}]: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 2. ProjectPhase
  for (const r of readTable("ProjectPhase.csv")) {
    try {
      const data = {
        code: r.code,
        name: r.name,
        isCompleted: b(r.isCompleted) ?? false,
        order: n(r.order) ?? 0,
        projectId: r.projectId,
        ownerId: validUser(s(r.ownerId), `ProjectPhase[${r.id}].ownerId`),
      };
      await db.projectPhase.upsert({
        where: { id: r.id },
        update: data,
        create: { id: r.id, ...data },
      });
      counts.phase++;
    } catch (e) {
      errors.push(`ProjectPhase[${r.id}]: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 3. ProjectTaskList
  for (const r of readTable("ProjectTaskList.csv")) {
    try {
      const data = {
        name: r.name,
        flag: s(r.flag) ?? "external",
        status: s(r.status) ?? "Active",
        sequence: n(r.sequence) ?? 1,
        phaseCode: s(r.phaseCode),
        projectId: r.projectId,
      };
      await db.projectTaskList.upsert({
        where: { id: r.id },
        update: data,
        create: { id: r.id, ...data },
      });
      counts.taskList++;
    } catch (e) {
      errors.push(`ProjectTaskList[${r.id}]: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 4. ProjectTask
  for (const r of readTable("ProjectTask.csv")) {
    try {
      const data = {
        code: r.code,
        title: r.title,
        order: n(r.order) ?? 0,
        phaseId: s(r.phaseId),
        phaseCode: s(r.phaseCode),
        phaseName: s(r.phaseName),
        taskListId: s(r.taskListId),
        taskListName: s(r.taskListName),
        isExternal: b(r.isExternal) ?? true,
        status: s(r.status) ?? "Open",
        authorId: validUser(s(r.authorId), `ProjectTask[${r.id}].authorId`),
        authorName: s(r.authorName),
        associatedTeam: s(r.associatedTeam),
        departmentAlias: s(r.departmentAlias),
        ownerId: validUser(s(r.ownerId), `ProjectTask[${r.id}].ownerId`),
        owner: s(r.owner) ?? "Unassigned",
        workHours: s(r.workHours),
        startDate: s(r.startDate),
        dueDate: s(r.dueDate),
        duration: s(r.duration),
        completionPercentage: n(r.completionPercentage) ?? 0,
        recurrence: s(r.recurrence),
        priority: s(r.priority),
        tags: tags(r.tags),
        reminder: s(r.reminder),
        billingType: s(r.billingType),
        description: s(r.description),
        isWarning: b(r.isWarning) ?? false,
        staleAlert: b(r.staleAlert) ?? false,
        lastActivityDate: d(r.lastActivityDate),
        hasAttachments: b(r.hasAttachments) ?? false,
        hasComments: b(r.hasComments) ?? false,
        hasReminder: b(r.hasReminder) ?? false,
        hasRecurrence: b(r.hasRecurrence) ?? false,
        projectId: s(r.projectId),
        parentTaskId: s(r.parentTaskId),
      };
      await db.projectTask.upsert({
        where: { id: r.id },
        update: data,
        create: { id: r.id, ...data },
      });
      counts.task++;
    } catch (e) {
      errors.push(`ProjectTask[${r.id}]: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 5. ProjectTaskOwner (requires taskId + userId)
  for (const r of readTable("ProjectTaskOwner.csv")) {
    const userId = validUser(s(r.userId), `ProjectTaskOwner[${r.id}].userId`);
    if (!userId) continue;
    try {
      const data = {
        taskId: r.taskId,
        userId,
        assignedById: validUser(s(r.assignedById), `ProjectTaskOwner[${r.id}].assignedById`),
        assignedAt: d(r.assignedAt) ?? new Date(),
      };
      await db.projectTaskOwner.upsert({
        where: { id: r.id },
        update: data,
        create: { id: r.id, ...data },
      });
      counts.taskOwner++;
    } catch (e) {
      errors.push(`ProjectTaskOwner[${r.id}]: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 6. ProjectMember (requires userId)
  for (const r of readTable("ProjectMember.csv")) {
    const userId = validUser(s(r.userId), `ProjectMember[${r.id}].userId`);
    if (!userId) continue;
    try {
      const data = {
        projectId: r.projectId,
        userId,
        costRate: n(r.costRate) ?? 0,
        hourlyRate: n(r.hourlyRate) ?? 0,
        joinedAt: d(r.joinedAt) ?? new Date(),
        projectRole: s(r.projectRole) ?? "Team Member",
        status: s(r.status) ?? "ACTIVE",
        weeklyCapacity: n(r.weeklyCapacity) ?? 40,
      };
      await db.projectMember.upsert({
        where: { id: r.id },
        update: data,
        create: { id: r.id, ...data },
      });
      counts.member++;
    } catch (e) {
      errors.push(`ProjectMember[${r.id}]: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 7. ProjectTimeLog (requires userId, taskId, phaseId, projectId)
  for (const r of readTable("ProjectTimeLog.csv")) {
    const userId = validUser(s(r.userId), `ProjectTimeLog[${r.id}].userId`);
    if (!userId) continue;
    try {
      const data = {
        projectId: r.projectId,
        phaseId: r.phaseId,
        taskId: r.taskId,
        userId,
        date: d(r.date) ?? new Date(),
        duration: n(r.duration) ?? 0,
        billingType: (s(r.billingType) ?? "NON_BILLABLE") as "BILLABLE" | "NON_BILLABLE",
        approvalStatus: (s(r.approvalStatus) ?? "PENDING") as "PENDING" | "APPROVED" | "REJECTED",
        description: s(r.description),
        rejectionReason: s(r.rejectionReason),
      };
      await db.projectTimeLog.upsert({
        where: { id: r.id },
        update: data,
        create: { id: r.id, ...data },
      });
      counts.timeLog++;
    } catch (e) {
      errors.push(`ProjectTimeLog[${r.id}]: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log("=== IMPORT COMPLETE ===");
  console.log(`DATABASE_URL host: ${new URL(process.env.DATABASE_URL ?? "").host || "(unset)"}`);
  console.log(`Projects upserted: ${counts.project}`);
  console.log(`Phases upserted: ${counts.phase}`);
  console.log(`Task lists upserted: ${counts.taskList}`);
  console.log(`Tasks upserted: ${counts.task}`);
  console.log(`Task owners upserted: ${counts.taskOwner}`);
  console.log(`Members upserted: ${counts.member}`);
  console.log(`Time logs upserted: ${counts.timeLog}`);
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
