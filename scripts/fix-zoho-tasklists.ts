// ONE-TIME FIX — Archive after running
//
// Re-derives ProjectTask.taskListId, and — this is the field that actually
// drives the Kanban board — the denormalized ProjectTask.phaseCode/phaseName
// (plus taskListName for display) from scripts/data/task_export.csv, for the
// WinOS (EEDP-76) project.
//
// TasksBoardView groups tasks purely by the string fields task.phaseCode /
// task.phaseName against a hardcoded DEFAULT_KANBAN_PHASES list of "1.1",
// "1.2", "2.1", ... "7.1" codes (src/features/projects/components/views/
// tasks-board-view.tsx) — it does NOT look at the taskListId/phaseId
// relations. The original import only set those relations, so every task's
// phaseCode/phaseName came back null, and getTasksAction defaults null to
// "1.1" / "CLIENT ONBOARDING" (project-actions.ts) — which is why every task
// piled into the first column. This fix backfills the denormalized fields
// so the board groups tasks correctly.
//
// No re-import, no changes to ProjectPhase/ProjectTaskList rows or time logs
// — only ProjectTask.taskListId/phaseCode/phaseName/taskListName.
const BOARD_CODE_NAMES: Record<string, string> = {
  "1.1": "1.1 CLIENT ON BOARDING",
  "1.2": "1.2 REQUIREMENT COLLECTION & DOCUMENTATION",
  "2.1": "2.1 UX RESEARCH & DISCOVERY",
  "2.2": "2.2 IDEATION & CONCEPTUALIZATION",
  "3.1": "3.1 UI/UX DESIGNING",
  "3.2": "3.2 GRAPHIC DESIGNING",
  "3.3": "3.3 CONTENT WRITING",
  "4.1": "4.1 DEVELOPMENT",
  "5.1": "5.1 TESTING",
  "6.1": "6.1 DEPLOYMENT AND SEO",
  "7.1": "7.1 MAINTENANCE & SUPPORT",
};
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ adapter } as any) as any;

const TASK_CSV = path.join(__dirname, "data", "task_export.csv");
const PROJECT_CODE = "EEDP-76";

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

function normalizeName(str: string): string {
  return (str ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

async function main() {
  const project = await db.project.findUnique({ where: { code: PROJECT_CODE } });
  if (!project) {
    console.error(`Project ${PROJECT_CODE} not found — nothing to fix.`);
    process.exit(1);
  }

  const taskLists = await db.projectTaskList.findMany({ where: { projectId: project.id } });
  const taskListMap = new Map<string, string>();
  for (const tl of taskLists) {
    taskListMap.set(normalizeName(tl.name), tl.id);
  }
  console.log(
    "Task lists loaded:",
    taskLists.map((t: { name: string; id: string }) => `${t.name} -> ${t.id}`)
  );

  const rows = parseCsv(fs.readFileSync(TASK_CSV, "utf-8"));
  const header = rows[0];
  const idx = (col: string) => header.indexOf(col);
  const col = { taskId: idx("Task ID"), taskListName: idx("Task List Name") };

  let updated = 0;
  let skipped = 0;
  const warnings: string[] = [];

  for (const r of rows.slice(1)) {
    const code = (r[col.taskId] ?? "").trim();
    if (!code) continue;

    const rawName = r[col.taskListName] ?? "";
    const normalizedName = normalizeName(rawName);
    const taskListId = taskListMap.get(normalizedName);
    if (!taskListId) {
      warnings.push(`Task ${code}: no task list match for "${rawName}" — skipped`);
      skipped++;
      continue;
    }

    const leadingMatch = rawName.trim().match(/^(\d+\.\d+)/);
    const boardCode = leadingMatch ? leadingMatch[1] : undefined;
    const boardName = boardCode ? BOARD_CODE_NAMES[boardCode] : undefined;
    if (!boardCode || !boardName) {
      warnings.push(`Task ${code}: could not derive board phaseCode from "${rawName}" — taskListId still fixed, phaseCode left as-is`);
    }

    const existing = await db.projectTask.findFirst({
      where: { code },
      select: { id: true, taskListId: true, phaseCode: true, phaseName: true, taskListName: true },
    });
    if (!existing) {
      warnings.push(`Task ${code}: not found in DB — skipped`);
      skipped++;
      continue;
    }

    const taskListDisplayName = rawName.trim();
    const needsUpdate =
      existing.taskListId !== taskListId ||
      (boardCode && existing.phaseCode !== boardCode) ||
      (boardName && existing.phaseName !== boardName) ||
      existing.taskListName !== taskListDisplayName;
    if (!needsUpdate) continue; // already correct

    await db.projectTask.update({
      where: { id: existing.id },
      data: {
        taskListId,
        taskListName: taskListDisplayName,
        ...(boardCode ? { phaseCode: boardCode } : {}),
        ...(boardName ? { phaseName: boardName } : {}),
      },
    });
    updated++;
  }

  console.log("=== FIX COMPLETE ===");
  console.log(`Tasks updated: ${updated}`);
  console.log(`Tasks skipped: ${skipped}`);
  if (warnings.length) console.log("WARNINGS:", warnings);

  console.log("\n=== VERIFICATION (by ProjectTaskList relation) ===");
  const counts = await db.projectTaskList.findMany({
    where: { projectId: project.id },
    select: { name: true, sequence: true, _count: { select: { tasks: true } } },
    orderBy: [{ phaseCode: "asc" }, { sequence: "asc" }],
  });
  let total = 0;
  for (const c of counts) {
    console.log(`${c.name}: ${c._count.tasks} tasks`);
    total += c._count.tasks;
  }
  console.log(`Total: ${total} tasks across ${counts.length} task lists`);

  console.log("\n=== VERIFICATION (by board phaseCode — what the Kanban view groups by) ===");
  const allTasks = await db.projectTask.findMany({
    where: { projectId: project.id },
    select: { phaseCode: true, phaseName: true },
  });
  const byBoardCode = new Map<string, number>();
  for (const t of allTasks) {
    const key = `${t.phaseCode ?? "(none)"} — ${t.phaseName ?? "(none)"}`;
    byBoardCode.set(key, (byBoardCode.get(key) ?? 0) + 1);
  }
  for (const [key, n] of [...byBoardCode.entries()].sort()) {
    console.log(`${key}: ${n} tasks`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
