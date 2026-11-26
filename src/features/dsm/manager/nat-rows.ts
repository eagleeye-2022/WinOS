import { db } from "@/lib/db";
import { ensureNatTaskForTimerAction, ensureUnassignedTaskForTimerAction } from "../actions/create-project-items";

type ProjectOnlyRow = { id: string; text: string; projectId: string };

/**
 * Manager-side counterpart of what `saveDsm` does on a member's submit: every DSM row that has a
 * project but no task gets the member's task named after the row in that project's
 * "Not Aligned Task (NAT)" list (their open one with the same name is reused), and the row is
 * linked to it — so the member can start a timer on it. Best-effort: a row whose project has no
 * NAT list is left linked to just its project, as before.
 */
export async function linkProjectOnlyRowsToNat(
  rows: ProjectOnlyRow[],
  memberId: string
): Promise<{ linked: number; failed: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  let linked = 0;
  let failed = 0;
  for (const row of rows) {
    const res = await ensureNatTaskForTimerAction(row.projectId, row.text, memberId);
    if (!res.success) {
      failed++;
      console.warn("[linkProjectOnlyRowsToNat] could not create a NAT task:", { text: row.text, error: res.error });
      continue;
    }
    await d.standupTask.update({ where: { id: row.id }, data: { projectTaskId: res.task.id } });
    linked++;
  }
  return { linked, failed };
}

/**
 * DSM rows with no project at all (e.g. a manager added a task without picking one): each gets
 * the member's task named after the row in the Unassigned Work holding project, and the row is
 * linked to it (project + task) — so the member can start a timer on it, and it can be moved to
 * the real project later. Best-effort: a row that can't be linked stays as it was.
 */
export async function linkNoProjectRowsToUnassigned(
  rows: { id: string; text: string }[],
  memberId: string
): Promise<{ linked: number; failed: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  let linked = 0;
  let failed = 0;
  for (const row of rows) {
    const res = await ensureUnassignedTaskForTimerAction(row.text, memberId);
    if (!res.success) {
      failed++;
      console.warn("[linkNoProjectRowsToUnassigned] could not create an Unassigned Work task:", { text: row.text, error: res.error });
      continue;
    }
    await d.standupTask.update({ where: { id: row.id }, data: { projectId: res.project.id, projectTaskId: res.task.id } });
    linked++;
  }
  return { linked, failed };
}
