// On-screen twin of the server's parent roll-up (parent-auto-close.ts), so a parent task closes /
// reopens the moment its subtask does instead of after a reload:
//   - closing a task's last open subtask closes the task (with the same status),
//   - reopening a subtask reopens its closed parent (with the same status),
// and so on up the tree. Pure — used inside setTasks updaters, then checked against the codes the
// server actually changed (reconcileRollup), since the server can refuse a close (SOP checklist).
import { isTaskDone, type TaskItem, type TaskStatus } from "../types";

/** A row or subtask-list entry, identified by any of its ids or its code. */
type Ref = { id?: string; dbId?: string; code?: string; parentTaskId?: string };

/** A parent the roll-up changed, with what it was before (to undo it). */
export type RollupChange = { code: string; status: TaskStatus; prevStatus: TaskStatus; prevPercent?: number };

const sameTask = (a: Ref, b: Ref): boolean => {
  if (a.code && b.code && a.code === b.code) return true;
  const aIds = [a.id, a.dbId].filter(Boolean);
  return [b.id, b.dbId].some((id) => !!id && aIds.includes(id));
};

const isChildOf = (row: TaskItem, parent: TaskItem): boolean =>
  !!row.parentTaskId && [parent.id, parent.dbId, parent.code].includes(row.parentTaskId);

function findParent(tasks: TaskItem[], child: Ref): TaskItem | undefined {
  const row = tasks.find((t) => sameTask(t, child));
  return (
    tasks.find((p) => !sameTask(p, child) && (p.subtasks || []).some((s) => sameTask(s, child))) ??
    (row ? tasks.find((p) => isChildOf(row, p)) : undefined)
  );
}

/** Are all of the parent's direct subtasks done (from its subtask list and from their own rows)? */
function allSubtasksDone(tasks: TaskItem[], parent: TaskItem): boolean {
  const done = new Map<string, boolean>();
  for (const s of parent.subtasks || []) done.set(s.code || s.id, isTaskDone(s.status, s.completed));
  // Their own rows are the fresher copy when both are loaded.
  for (const t of tasks) if (isChildOf(t, parent)) done.set(t.code, isTaskDone(t.status, false, t.completionPercentage));
  return done.size > 0 && [...done.values()].every(Boolean);
}

/** Sets one task's status on its own row and on its entry in any parent's subtask list. */
export function setTaskStatusInList(
  tasks: TaskItem[],
  target: Ref,
  status: TaskStatus,
  percent?: number
): TaskItem[] {
  const done = isTaskDone(status);
  return tasks.map((t) => {
    let next = t;
    if ((t.subtasks || []).some((s) => sameTask(s, target))) {
      next = {
        ...next,
        subtasks: (next.subtasks || []).map((s) => (sameTask(s, target) ? { ...s, status, completed: done } : s)),
      };
    }
    if (sameTask(t, target)) {
      const completionPercentage =
        percent ?? (done ? 100 : (t.completionPercentage ?? 0) >= 100 ? 0 : t.completionPercentage);
      next = { ...next, status, completionPercentage };
    }
    return next;
  });
}

/**
 * Sets `target`'s status, then closes / reopens its parents as the server will. Returns the new
 * list and the parents it changed (nearest first).
 */
export function applyStatusWithRollup(
  tasks: TaskItem[],
  target: Ref,
  status: TaskStatus
): { tasks: TaskItem[]; changes: RollupChange[] } {
  let next = setTaskStatusInList(tasks, target, status);
  const changes: RollupChange[] = [];
  const closing = isTaskDone(status);
  const seen = new Set<string>();
  let child: Ref = target;
  for (;;) {
    const parent = findParent(next, child);
    if (!parent || seen.has(parent.code)) break;
    seen.add(parent.code);
    const parentDone = isTaskDone(parent.status, false, parent.completionPercentage);
    if (closing ? parentDone || !allSubtasksDone(next, parent) : !parentDone) break;
    changes.push({ code: parent.code, status, prevStatus: parent.status, prevPercent: parent.completionPercentage });
    next = setTaskStatusInList(next, parent, status);
    child = parent;
  }
  return { tasks: next, changes };
}

/**
 * After the save: undoes the parents shown changed that the server didn't change (e.g. one still
 * needs its SOP checklist), and applies any it changed that weren't shown (not loaded on screen).
 */
export function reconcileRollup(
  tasks: TaskItem[],
  shown: RollupChange[],
  serverCodes: string[] | undefined,
  status: TaskStatus
): TaskItem[] {
  const server = new Set(serverCodes ?? []);
  let next = tasks;
  // Farthest first, so a nearer parent's undo isn't overwritten.
  for (const c of [...shown].reverse()) {
    if (!server.has(c.code)) next = setTaskStatusInList(next, { code: c.code }, c.prevStatus, c.prevPercent);
  }
  const shownCodes = new Set(shown.map((c) => c.code));
  for (const code of server) {
    if (!shownCodes.has(code)) next = setTaskStatusInList(next, { code }, status);
  }
  return next;
}

/**
 * A page's `onUpdateTask`: swaps in the edited row and, when its status changed, rolls its parents
 * up on screen too (and fixes its entry in the parent's subtask list).
 */
export function replaceTaskWithRollup(
  tasks: TaskItem[],
  updated: TaskItem,
  previous: TaskItem | undefined
): { tasks: TaskItem[]; changes: RollupChange[] } {
  const replaced = tasks.map((t) => (t.id === updated.id ? updated : t));
  if (!previous || previous.status === updated.status) return { tasks: replaced, changes: [] };
  return applyStatusWithRollup(replaced, updated, updated.status);
}

/** Undoes a refused `onUpdateTask` edit: the row back as it was, and its entry in its parent's list. */
export function revertTaskInList(tasks: TaskItem[], previous: TaskItem): TaskItem[] {
  const restored = tasks.map((t) => (t.id === previous.id ? previous : t));
  return setTaskStatusInList(restored, previous, previous.status, previous.completionPercentage);
}

/**
 * After the save (`result` null when it failed): the list with the parents shown changed matched
 * to what the server really changed (autoClosedParents / autoReopenedParents).
 */
export function settleRollupList(
  tasks: TaskItem[],
  shown: RollupChange[],
  result: { autoClosedParents?: string[]; autoReopenedParents?: string[] } | null,
  status: TaskStatus
): TaskItem[] {
  const serverCodes = result ? [...(result.autoClosedParents ?? []), ...(result.autoReopenedParents ?? [])] : [];
  return sameRollup(shown, serverCodes) ? tasks : reconcileRollup(tasks, shown, serverCodes, status);
}

/** "All subtasks are done — EEDP-T02 was closed too", or null when no parent changed. */
export function rollupMessage(changes: RollupChange[]): string | null {
  if (changes.length === 0) return null;
  const list = changes.map((c) => c.code).join(", ");
  const verb = changes.length > 1 ? "were" : "was";
  return isTaskDone(changes[0].status)
    ? `All subtasks are done — ${list} ${verb} closed too`
    : `A subtask was reopened — ${list} ${verb} reopened too`;
}

/** Same codes, any order? */
export function sameRollup(shown: RollupChange[], serverCodes: string[] | undefined): boolean {
  const server = serverCodes ?? [];
  return shown.length === server.length && shown.every((c) => server.includes(c.code));
}
