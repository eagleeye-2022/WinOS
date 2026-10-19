import { db } from "@/lib/db";
import { dateToProjectDueDate, effectiveDsmDueDate, projectDueDateToDate } from "@/lib/task-due-date";

/**
 * Keeps a DSM task's due date and its linked Srijan task's due date the same, in both directions:
 *  - DSM → Srijan: `syncDueDateFromDsm` after a DSM row is saved with a due date.
 *  - Srijan → DSM: `syncDueDateFromProjectTask` after a Srijan task's due date changes.
 * Reads also prefer the Srijan date (`withLinkedDueDates`), which covers rows saved before this sync.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const d = db as any;

/**
 * DSM → Srijan. Writes the date to the linked project task, and to every other DSM row linked to
 * the same task, so all of them agree. A DSM row saved *without* a date doesn't clear the Srijan
 * date — the DSM form often re-saves rows whose date field was simply left empty.
 */
export async function syncDueDateFromDsm(projectTaskId: string | null | undefined, dueDate: Date | null | undefined) {
  if (!projectTaskId || !dueDate || Number.isNaN(dueDate.getTime())) return;
  try {
    const task = await d.projectTask.findUnique({ where: { id: projectTaskId }, select: { dueDate: true } });
    if (!task) return;
    const next = dateToProjectDueDate(dueDate);
    await Promise.all([
      task.dueDate === next
        ? null
        : d.projectTask.update({ where: { id: projectTaskId }, data: { dueDate: next, lastActivityDate: new Date() } }),
      d.standupTask.updateMany({
        where: { projectTaskId, NOT: { dueDate } },
        data: { dueDate },
      }),
    ]);
  } catch (err) {
    // Best effort: the DSM save itself already succeeded.
    console.error("[due-date-sync] DSM → Srijan failed:", err);
  }
}

/** Several DSM rows at once (the DSM form saves all of a day's tasks together). */
export async function syncDueDatesFromDsm(rows: { projectTaskId: string | null; dueDate: Date | null }[]) {
  // One write per task; if the same task appears twice, the last row's date wins.
  const byTask = new Map<string, Date>();
  for (const r of rows) if (r.projectTaskId && r.dueDate) byTask.set(r.projectTaskId, r.dueDate);
  await Promise.all([...byTask].map(([id, date]) => syncDueDateFromDsm(id, date)));
}

/** Srijan → DSM. Every DSM row linked to this project task (by its db id) takes the new date. */
export async function syncDueDateFromProjectTask(projectTaskDbId: string, projectDueDate: string | null | undefined) {
  try {
    await d.standupTask.updateMany({
      where: { projectTaskId: projectTaskDbId },
      data: { dueDate: projectDueDateToDate(projectDueDate) },
    });
  } catch (err) {
    console.error("[due-date-sync] Srijan → DSM failed:", err);
  }
}

type TaskWithLink = { dueDate?: Date | string | null; projectTask?: { dueDate?: string | null } | null };

/**
 * Read side: a linked DSM row shows its Srijan task's due date when that task has one. Use on
 * query results whose `projectTask` select includes `dueDate`.
 */
export function withLinkedDueDates<T extends TaskWithLink>(tasks: T[]): T[] {
  return tasks.map((t) =>
    t.projectTask?.dueDate ? { ...t, dueDate: effectiveDsmDueDate(t.dueDate, t.projectTask.dueDate) } : t
  );
}

/** `withLinkedDueDates` applied to each entry's tasks (entries without a `tasks` array pass through). */
export function entriesWithLinkedDueDates<E>(entries: E[]): E[] {
  return entries.map((e) => {
    const tasks = (e as { tasks?: TaskWithLink[] }).tasks;
    return Array.isArray(tasks) ? { ...e, tasks: withLinkedDueDates(tasks) } : e;
  });
}
