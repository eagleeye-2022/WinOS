/**
 * Whyfi Learning (Pulse → /pulse/whyfi-learning) stores its data in the existing Projects tables
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

/**
 * Learning time is ordinary project time logs, so it already shows in the Effort Logs, Active
 * Timers, DSM effort card and Report. This labels its "project" there as "Whyfi Learning · <list>"
 * so it's recognisable (and sorts together) next to client projects.
 */
export function effortProjectLabel(name: string, projectCategory?: string | null): string {
  return projectCategory === LEARNING_PROJECT_CATEGORY ? `Whyfi Learning · ${name}` : name;
}

/** Prisma `where` fragment that excludes learning lists from regular project queries. */
export const NOT_LEARNING_PROJECT = {
  OR: [{ projectCategory: null }, { projectCategory: { not: LEARNING_PROJECT_CATEGORY } }],
};

/**
 * DSM learning rows are plain text (`StandupEntry.learningText`, one line per item), so a row
 * linked to a learning card is stored as "[WL-1-T3] Card title …". These read/write that prefix.
 */
const LINKED_LINE_RE = /^\[(WL-\d+-T\d+)\]\s*/;

export function parseLearningLineCode(text: string): string | null {
  return text.trim().match(LINKED_LINE_RE)?.[1] ?? null;
}

export function stripLearningLineCode(text: string): string {
  return text.trim().replace(LINKED_LINE_RE, "");
}

export function formatLearningLine(code: string, text: string): string {
  return `[${code}] ${stripLearningLineCode(text)}`.trim();
}
