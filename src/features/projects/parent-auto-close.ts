// Zoho-style roll-up: when the last open subtask of a task is closed, the task closes itself — and
// so on up the tree (a closed sub-subtask can close its subtask, which can close the top task).
// The other way too: reopening a subtask reopens its closed parent(s).
// Plain server module (not "use server") — called from the task status write paths after a task
// has been saved as done.
import { db } from "@/lib/db";
import { canCloseWithoutSop, checklistCloseBlock, forcedCloseOf } from "@/features/sop-checklists/close-gate";
import { recordTaskClosed } from "@/features/sop-checklists/events";
import { toInitials } from "@/features/sop-checklists/access";
import { isTaskDone } from "./types";
import { openSubtasksOf } from "./subtask-gate";

/**
 * Closes the parent(s) of `taskId` whose subtasks are now all done, with `doneStatus` (the status
 * the subtask was closed with, e.g. "Done"). Same rules as closing a task by hand: a parent that
 * needs an SOP checklist first stays open unless `actor` is a manager (then it's recorded as a
 * forced close). Returns the codes of the tasks it closed. Never throws — a failure here must not
 * undo or fail the subtask's own save.
 */
export async function closeParentsWhenSubtasksDone(
  taskId: string,
  actor: { id: string; name: string },
  doneStatus: string = "Done"
): Promise<string[]> {
  const closed: string[] = [];
  try {
    const status = isTaskDone(doneStatus) ? doneStatus : "Done";
    let child = await db.projectTask.findFirst({
      where: { OR: [{ id: taskId }, { code: taskId }] },
      select: { id: true, parentTaskId: true },
    });
    const seen = new Set<string>();
    while (child?.parentTaskId) {
      // parentTaskId holds the parent's id (or, on older rows, its code).
      const parent = await db.projectTask.findFirst({
        where: { OR: [{ id: child.parentTaskId }, { code: child.parentTaskId }] },
        select: { id: true, code: true, parentTaskId: true, status: true, completionPercentage: true },
      });
      if (!parent || seen.has(parent.id)) break;
      seen.add(parent.id);
      if (isTaskDone(parent.status, false, parent.completionPercentage)) break;
      if ((await openSubtasksOf(parent.id)).length > 0) break;

      const block = await checklistCloseBlock(parent.id);
      if (block && !(await canCloseWithoutSop(actor.id))) break;

      await db.projectTask.update({
        where: { id: parent.id },
        data: { status, completionPercentage: 100, lastActivityDate: new Date() },
      });
      // Legacy mirror row, when the parent is itself a subtask.
      await db.projectSubtask
        .updateMany({ where: { id: parent.id }, data: { status, completed: true } })
        .catch(() => {});
      await db.projectTaskActivity.create({
        data: {
          taskId: parent.id,
          userId: actor.id,
          userName: actor.name,
          userInitials: toInitials(actor.name) || "U",
          actionText: `changed status from "${parent.status}" to "${status}" (all subtasks are done)`,
        },
      });
      await recordTaskClosed(actor, parent.id, block ? forcedCloseOf(block) : null);

      closed.push(parent.code);
      child = parent;
    }
  } catch (err) {
    console.error("[parent-auto-close] Couldn't close the parent task:", err);
  }
  return closed;
}

/**
 * Reopens the closed parent(s) of `taskId`, which was just reopened, with `openStatus` (the status
 * the subtask was reopened with, e.g. "Open" or "In Progress"). Walks up while the parents are
 * closed — a task can't stay done with an open subtask under it. Returns the codes it reopened.
 * Never throws — a failure here must not undo or fail the subtask's own save.
 */
export async function reopenParentsOfReopenedTask(
  taskId: string,
  actor: { id: string; name: string },
  openStatus: string = "Open"
): Promise<string[]> {
  const reopened: string[] = [];
  try {
    const status = isTaskDone(openStatus) ? "Open" : openStatus;
    let child = await db.projectTask.findFirst({
      where: { OR: [{ id: taskId }, { code: taskId }] },
      select: { id: true, parentTaskId: true },
    });
    const seen = new Set<string>();
    while (child?.parentTaskId) {
      const parent = await db.projectTask.findFirst({
        where: { OR: [{ id: child.parentTaskId }, { code: child.parentTaskId }] },
        select: { id: true, code: true, parentTaskId: true, status: true, completionPercentage: true },
      });
      if (!parent || seen.has(parent.id)) break;
      seen.add(parent.id);
      if (!isTaskDone(parent.status, false, parent.completionPercentage)) break;

      await db.projectTask.update({
        where: { id: parent.id },
        // Also drop the 100% — isTaskDone treats it as done.
        data: { status, completionPercentage: 0, lastActivityDate: new Date() },
      });
      await db.projectSubtask
        .updateMany({ where: { id: parent.id }, data: { status, completed: false } })
        .catch(() => {});
      await db.projectTaskActivity.create({
        data: {
          taskId: parent.id,
          userId: actor.id,
          userName: actor.name,
          userInitials: toInitials(actor.name) || "U",
          actionText: `changed status from "${parent.status}" to "${status}" (a subtask was reopened)`,
        },
      });

      reopened.push(parent.code);
      child = parent;
    }
  } catch (err) {
    console.error("[parent-auto-close] Couldn't reopen the parent task:", err);
  }
  return reopened;
}
