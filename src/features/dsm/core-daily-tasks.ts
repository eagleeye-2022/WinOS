/**
 * EED Core's shared daily-activity tasks (DSM, DSMA, internal meetings, …) — every EED Core
 * member logs effort against these each day, so the /dsm side panel pins them with a timer and
 * any project member may start that timer, not just the task's owners. Identified by the task
 * list they live in rather than hardcoded ids, so tasks added to that list in Zoho show up too.
 * Pure constants/helpers, safe to import from server actions and client components alike.
 */

export const CORE_DAILY_TASKS_PROJECT_CODE = "EEDP-4"; // EED Core
export const CORE_DAILY_TASKS_LIST_NAME = "EED Meetings & Core Things";

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
