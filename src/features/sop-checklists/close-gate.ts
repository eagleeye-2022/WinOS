/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/db";
import { evaluateCloseGate, isChecklistExemptTask } from "./utils";
import { loadActingUser } from "./access";
import type { ChecklistCloseBlock } from "./types";

const d = db as any;

/**
 * Managers may close a task without selecting or completing its SOP checklist; the close is
 * recorded on the SOP timeline as forced. Everyone else must complete the checklist first.
 */
export async function canCloseWithoutSop(userId: string): Promise<boolean> {
  try {
    return (await loadActingUser(userId))?.isManager ?? false;
  } catch {
    return false;
  }
}

/** The SOP timeline's "forced" note for a close that skipped the checklist. */
export function forcedCloseOf(block: ChecklistCloseBlock) {
  return { reason: block.reason, done: block.done, total: block.total };
}

/**
 * A Srijan project task (or subtask) can't be moved to a done status until it has an SOP checklist
 * and every item of it is ticked. WhyFi School cards, NAT tasks and the daily DSM/DSR tasks are
 * exempt (isChecklistExemptTask). Returns why closing is blocked, or null when it's allowed.
 * Managers skip the block at the write paths (canCloseWithoutSop); `canForce` stays false since
 * no one else can override it.
 *
 * Plain server module (not a Server Action) — called from the task status write paths
 * (updateTaskAction, updateSubtaskAction, the DSM standup toggle).
 */
export async function checklistCloseBlock(taskId: string): Promise<ChecklistCloseBlock | null> {
  // Fails open: if the check itself errors (e.g. a database without the SOP tables yet), the task
  // closes exactly as it did before SOP checklists existed — this must never break closing tasks.
  try {
    return await evaluateTask(taskId);
  } catch (err) {
    console.error("[sop-close-gate] Checklist check failed — allowing the close:", err);
    return null;
  }
}

async function evaluateTask(taskId: string): Promise<ChecklistCloseBlock | null> {
  const task = await d.projectTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      code: true,
      title: true,
      taskListName: true,
      phaseName: true,
      projectId: true,
      project: { select: { code: true, projectCategory: true } },
      checklists: { select: { items: { select: { checked: true, isRemovedFromSop: true } } } },
    },
  });
  if (!task) return null;
  if (isChecklistExemptTask({ ...task, projectCategory: task.project?.projectCategory })) return null;

  const gate = evaluateCloseGate(task.checklists.map((c: any) => c.items));
  if (!gate) return null;
  return {
    ...gate,
    taskId: task.id,
    taskCode: task.code,
    projectCode: task.project?.code ?? task.projectId ?? null,
    canForce: false,
  };
}
