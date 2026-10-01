/**
 * EED Core's shared daily-activity tasks (DSM, DSMA, internal meetings, …) — every EED Core
 * member logs effort against these each day, so the /dsm side panel pins them with a timer and
 * any project member may start that timer, not just the task's owners. Identified by the task
 * list they live in rather than hardcoded ids, so tasks added to that list in Zoho show up too.
 * Pure constants/helpers, safe to import from server actions and client components alike.
 */

export const CORE_DAILY_TASKS_PROJECT_CODE = "EEDP-4"; // EED Core
export const CORE_DAILY_TASKS_LIST_NAME = "EED Meetings & Core Things";

/** Display order on the panel, by task title. Tasks not listed here follow, sorted by code. */
export const CORE_DAILY_TASKS_ORDER = ["DSMB", "DSM", "DSMA", "Internal Meetings"];

export function sortCoreDailyTasks<T extends { title: string; code: string }>(tasks: T[]): T[] {
  const rank = (t: T) => {
    const i = CORE_DAILY_TASKS_ORDER.findIndex((title) => title.toLowerCase() === t.title.trim().toLowerCase());
    return i === -1 ? CORE_DAILY_TASKS_ORDER.length : i;
  };
  return [...tasks].sort((a, b) => rank(a) - rank(b) || a.code.localeCompare(b.code));
}

/** Fallback "what is this task" text, by title, used when the task has no description of its own. */
export const CORE_DAILY_TASKS_FALLBACK_DESCRIPTIONS: Record<string, string> = {
  DSM: "Daily Standup Meeting — log the time you spend in the daily standup here.",
};

/** Statuses that hide a core task from the panel. */
export const CORE_DAILY_TASKS_CLOSED_STATUSES = ["Closed", "Completed", "Done"];

export function isCoreDailyTask(task: {
  taskListName?: string | null;
  project?: { code?: string | null } | null;
}): boolean {
  return (
    task.project?.code === CORE_DAILY_TASKS_PROJECT_CODE &&
    task.taskListName === CORE_DAILY_TASKS_LIST_NAME
  );
}
