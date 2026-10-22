/**
 * WhyFi School (Pulse → /pulse/whyfi-learning) stores its data in the existing Projects tables
 * rather than new ones: each shareable learning *task list* is a `Project` row with
 * `projectCategory = "LEARNING"` (one phase, one task list), its cards are `ProjectTask` rows, and
 * "sharing the list with a user" is a `ProjectMember` row. That reuses the project timer, time logs
 * and effort log unchanged. Learning projects are filtered out of the regular Projects views.
 * Pure constants/helpers, safe to import from server actions and client components alike.
 */

import { PROJECT_TASK_STATUSES } from "@/features/projects/types";

export const LEARNING_PROJECT_CATEGORY = "LEARNING";

/** Project code prefix for learning lists ("WL-1"); its cards are "WL-1-T1", "WL-1-T2", … */
export const LEARNING_CODE_PREFIX = "WL";

/** The single phase/task list every learning list is scaffolded with. */
export const LEARNING_PHASE_CODE = "1.1";
export const LEARNING_PHASE_NAME = "Learning Tasks";

/** Same statuses as project tasks (plus "Closed", which imported/Zoho tasks use for done). */
export const LEARNING_TASK_STATUSES: readonly string[] = [...PROJECT_TASK_STATUSES, "Closed"];

/** Statuses that count a learning card as finished (mirrors `isTaskDone`). */
export const LEARNING_DONE_STATUSES = ["Done", "Closed", "Approved", "Completed"];

/** How a WhyFi School task's "project" reads in effort logs, timers, the DSM effort card and Report. */
export const WHYFI_PROJECT_LABEL = "WhyFi School";
/** Short form for tight Project columns (e.g. the DSM "What Did You Do Yesterday?" table). */
export const WHYFI_SHORT_LABEL = "WFS";

/**
 * Learning time is ordinary project time logs, so it already shows in the Effort Logs, Active
 * Timers, DSM effort card and Report. There its "project" is just "WhyFi School" (not the task
 * list's name), so learning time reads as one thing next to client projects.
 */
export function effortProjectLabel(name: string, projectCategory?: string | null): string {
  return projectCategory === LEARNING_PROJECT_CATEGORY ? WHYFI_PROJECT_LABEL : name;
}

/**
 * `ProjectTask.dueDate` is a free-form string: "YYYY-MM-DD" (WhyFi), "DD/MM/YYYY" (imported from
 * Zoho/projects) or "--"/empty. Returns "YYYY-MM-DD", or "" when there's no valid date.
 */
export function normalizeDueDate(raw: string | null | undefined): string {
  const s = (raw || "").trim();
  let y: string, m: string, d: string;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (iso) [, y, m, d] = iso;
  else if (dmy) [y, m, d] = [dmy[3], dmy[2].padStart(2, "0"), dmy[1].padStart(2, "0")];
  else return "";
  const date = new Date(`${y}-${m}-${d}T00:00:00Z`);
  return !isNaN(date.getTime()) && date.getUTCDate() === Number(d) ? `${y}-${m}-${d}` : "";
}

/**
 * Next "<prefix>-T<n>" task code: one past the highest number already used in the project (or
 * past `floor`, e.g. the task count). WhyFi lists number every card this way, subtasks included,
 * and a plain count would reuse a code once a task has been deleted.
 */
export function nextTaskCode(prefix: string, existingCodes: string[], floor = 0): string {
  let max = floor;
  for (const code of existingCodes) {
    const n = Number(code.match(/-T(\d+)$/)?.[1]);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}-T${max + 1}`;
}

/**
 * WhyFi School task IDs: "WIFI" + one running number across all learning lists ("WIFI1",
 * "WIFI2" … "WIFI12"), subtasks included. Older tasks keep their "WL-<list>-T<n>" IDs.
 */
export const WHYFI_TASK_CODE_PREFIX = "WIFI";
const WHYFI_TASK_CODE_RE = /^WIFI(\d+)$/i;

/** Next "WIFI<n>": one past the highest "WIFI<n>" in `existingCodes` (other codes are ignored). */
export function nextWhyfiTaskCode(existingCodes: string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const n = Number(code.match(WHYFI_TASK_CODE_RE)?.[1]);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${WHYFI_TASK_CODE_PREFIX}${max + 1}`;
}

/** The list prefix of a WhyFi card code: "WL-3-T12" → "WL-3" (also for dotted "WL-3-T12.1"). */
export function learningListPrefix(taskCode: string): string {
  return taskCode.replace(/-T\d+(\.\d+)*$/, "");
}

/** Prisma `where` fragment that excludes learning lists from regular project queries. */
export const NOT_LEARNING_PROJECT = {
  OR: [{ projectCategory: null }, { projectCategory: { not: LEARNING_PROJECT_CATEGORY } }],
};

/**
 * DSM learning rows are plain text (`StandupEntry.learningText`, one line per item), so a row
 * linked to a learning card is stored as "[WIFI12] Card title …" (older cards: "[WL-1-T3] …").
 * These read/write that prefix.
 */
const LINKED_LINE_RE = /^\[(WL-\d+-T\d+|WIFI\d+)\]\s*/;

export function parseLearningLineCode(text: string): string | null {
  return text.trim().match(LINKED_LINE_RE)?.[1] ?? null;
}

export function stripLearningLineCode(text: string): string {
  return text.trim().replace(LINKED_LINE_RE, "");
}

export function formatLearningLine(code: string, text: string): string {
  return `[${code}] ${stripLearningLineCode(text)}`.trim();
}
