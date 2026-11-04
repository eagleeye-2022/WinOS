import type { TaskItem } from "../types";

/**
 * The task list after deleting `idOrCode`: drops that task's row, the rows of every subtask under
 * it (the database removes those too — `parentTaskId` cascades), and their entries in any parent's
 * `subtasks` list, which is what a parent's Subtasks table shows. Subtask entries carry the db id
 * while rows are keyed by code, so both are matched.
 */
export function removeTaskFromList(tasks: TaskItem[], idOrCode: string): TaskItem[] {
  const byKey = new Map<string, TaskItem>();
  for (const t of tasks) {
    byKey.set(t.id, t);
    byKey.set(t.code, t);
    if (t.dbId) byKey.set(t.dbId, t);
  }
  // A subtask entry's db id → its row (found by the entry's code).
  for (const t of tasks) {
    for (const s of t.subtasks ?? []) {
      const subRow = byKey.get(s.code);
      if (subRow && !byKey.has(s.id)) byKey.set(s.id, subRow);
    }
  }

  const removed = new Set<string>([idOrCode]);
  const queue = [idOrCode];
  while (queue.length > 0) {
    const key = queue.shift()!;
    const row = byKey.get(key);
    const children = [
      ...(row?.subtasks ?? []).flatMap((s) => [s.id, s.code]),
      ...tasks.filter((t) => t.parentTaskId && (t.parentTaskId === key || t.parentTaskId === row?.id || t.parentTaskId === row?.code)).map((t) => t.code),
    ];
    if (row) removed.add(row.id).add(row.code);
    for (const child of children) {
      if (!removed.has(child)) {
        removed.add(child);
        queue.push(child);
      }
    }
  }

  return tasks
    .filter((t) => !removed.has(t.id) && !removed.has(t.code))
    .map((t) =>
      t.subtasks?.some((s) => removed.has(s.id) || removed.has(s.code))
        ? { ...t, subtasks: t.subtasks.filter((s) => !removed.has(s.id) && !removed.has(s.code)) }
        : t
    );
}
