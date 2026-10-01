"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Manager CRUD for the "What Did You Do Yesterday?" summary on the member review page.
 *
 * The summary is the member's *previous* DSM entry, which the manager has usually already
 * reviewed that morning — so unlike editTask/deleteTask these deliberately do NOT block on a
 * REVIEWED entry: the review covered the plan, the summary records what actually got done.
 * Ticking a task done here does not close the linked project task (see toggleStandupTask for
 * the member-side toggle, which does).
 */

export type SummaryTaskState = { message?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const d = db as any;

async function requireManagerUser() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") return null;
  // Re-query so a stale JWT pointing at a deleted user fails cleanly instead of on an FK.
  const user = await d.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true } });
  return user as { id: string; name: string | null } | null;
}

function revalidateMember(userId: string) {
  revalidatePath(`/dsm/member/${userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsm");
}

async function logTimeline(entryId: string, label: string) {
  await d.standupTimelineEvent.create({
    data: { entryId, type: "TASK_SUMMARY_EDITED", label, occurredAt: new Date() },
  });
}

/** DSR planned tasks aren't linked to DSM tasks by id — they share text, matched the same way
 *  getDsrProjectTaskLinks does. */
const normText = (s: string) => s.trim().toLowerCase();

export type DsrDayCompletion = {
  hasDsr: boolean;
  /** Normalized planned-task text → ticked in that day's DSR. */
  completed: Record<string, boolean>;
  /** "Additional Work Done Today" items from that day's DSR — work done outside the planned tasks. */
  additionalWorks: { id: string; text: string; completed: boolean }[];
};

/** The member's DSR ticks for one day, used as the source of truth for "done" in the summary. */
export async function getDsrCompletionForDay(memberId: string, dateStr: string): Promise<DsrDayCompletion> {
  const manager = await requireManagerUser();
  if (!manager || !memberId || !dateStr) return { hasDsr: false, completed: {}, additionalWorks: [] };

  const dsr = await d.dsrEntry.findUnique({
    where: { userId_date: { userId: memberId, date: new Date(dateStr.slice(0, 10) + "T00:00:00.000Z") } },
    select: {
      plannedTasks: { select: { text: true, completed: true } },
      additionalWorks: { select: { id: true, text: true, completed: true }, orderBy: { order: "asc" } },
    },
  });
  if (!dsr) return { hasDsr: false, completed: {}, additionalWorks: [] };

  const completed: Record<string, boolean> = {};
  for (const t of dsr.plannedTasks as { text: string; completed: boolean }[]) {
    completed[normText(t.text)] = t.completed;
  }
  return { hasDsr: true, completed, additionalWorks: dsr.additionalWorks };
}

/** Mirror a manager's done/not-done onto the matching DSR planned task (and its counters), so
 *  the DSR — which the summary reads first — doesn't contradict the manager's change. */
async function syncDsrPlannedTask(userId: string, date: Date, text: string, isCompleted: boolean) {
  const dsr = await d.dsrEntry.findUnique({
    where: { userId_date: { userId, date } },
    select: { id: true, plannedTasks: { select: { id: true, text: true, completed: true } } },
  });
  if (!dsr) return;

  const planned = dsr.plannedTasks as { id: string; text: string; completed: boolean }[];
  const matches = planned.filter((t) => normText(t.text) === normText(text) && t.completed !== isCompleted);
  if (matches.length === 0) return;

  await d.dsrPlannedTask.updateMany({ where: { id: { in: matches.map((m) => m.id) } }, data: { completed: isCompleted } });
  const matchIds = new Set(matches.map((m) => m.id));
  const completedCount = planned.filter((t) => (matchIds.has(t.id) ? isCompleted : t.completed)).length;
  await d.dsrEntry.update({
    where: { id: dsr.id },
    data: {
      completedTaskCount: completedCount,
      completionPercent: planned.length > 0 ? Math.round((completedCount / planned.length) * 100) : 0,
    },
  });
}

export async function toggleSummaryTask(taskId: string, isCompleted: boolean): Promise<SummaryTaskState> {
  const manager = await requireManagerUser();
  if (!manager) return { message: "Unauthorized" };

  const task = await d.standupTask.findUnique({
    where: { id: taskId },
    select: { text: true, entryId: true, entry: { select: { userId: true, date: true } } },
  });
  if (!task) return { message: "Task not found" };

  await d.standupTask.update({ where: { id: taskId }, data: { isCompleted, editedById: manager.id } });
  await syncDsrPlannedTask(task.entry.userId, task.entry.date, task.text, isCompleted);
  await logTimeline(
    task.entryId,
    `${manager.name ?? "Manager"} marked "${task.text}" as ${isCompleted ? "done" : "not done"}`
  );

  revalidateMember(task.entry.userId);
  return { message: "updated" };
}

/** Creates a task on `entryId` when no `taskId` is given, otherwise updates that task. */
export async function saveSummaryTask(_prev: SummaryTaskState, formData: FormData): Promise<SummaryTaskState> {
  const manager = await requireManagerUser();
  if (!manager) return { message: "Unauthorized" };

  const taskId = (formData.get("taskId") as string | null)?.trim() || "";
  const entryId = (formData.get("entryId") as string | null)?.trim() || "";
  const text = (formData.get("text") as string | null)?.trim() || "";
  const projectTaskId = (formData.get("projectTaskId") as string | null)?.trim() || null;
  const isCompleted = formData.get("isCompleted") === "true";

  if (!text) return { message: "Task text cannot be empty" };

  if (taskId) {
    const existing = await d.standupTask.findUnique({
      where: { id: taskId },
      select: { entryId: true, text: true, entry: { select: { userId: true, date: true } } },
    });
    if (!existing) return { message: "Task not found" };

    await d.standupTask.update({
      where: { id: taskId },
      data: { text, projectTaskId, isCompleted, editedById: manager.id },
    });
    // Match on the pre-edit text: that's what the DSR planned task still carries.
    await syncDsrPlannedTask(existing.entry.userId, existing.entry.date, existing.text, isCompleted);
    await logTimeline(existing.entryId, `${manager.name ?? "Manager"} edited yesterday's task: "${text}"`);
    revalidateMember(existing.entry.userId);
    return { message: "saved" };
  }

  if (!entryId) return { message: "Missing entry" };
  const entry = await d.standupEntry.findUnique({
    where: { id: entryId },
    select: { userId: true, status: true, tasks: { select: { order: true } } },
  });
  if (!entry) return { message: "Entry not found" };

  // "YESTERDAY" is only used when there is no previous entry to attach to (legacy explicit rows).
  const kind = formData.get("kind") === "YESTERDAY" ? "YESTERDAY" : "TODAY";
  const maxOrder = entry.tasks.reduce((max: number, t: { order: number }) => Math.max(max, t.order ?? 0), -1);

  await d.standupTask.create({
    data: {
      entryId,
      kind,
      text,
      projectTaskId,
      isCompleted,
      order: maxOrder + 1,
      addedAfterReview: entry.status === "REVIEWED",
      addedById: manager.id,
    },
  });
  await logTimeline(entryId, `${manager.name ?? "Manager"} added to yesterday's summary: "${text}"`);
  revalidateMember(entry.userId);
  return { message: "saved" };
}

export async function deleteSummaryTask(_prev: SummaryTaskState, formData: FormData): Promise<SummaryTaskState> {
  const manager = await requireManagerUser();
  if (!manager) return { message: "Unauthorized" };

  const taskId = (formData.get("taskId") as string | null)?.trim();
  if (!taskId) return { message: "Missing task" };

  const task = await d.standupTask.findUnique({
    where: { id: taskId },
    select: { text: true, entryId: true, entry: { select: { userId: true } } },
  });
  if (!task) return { message: "Task not found" };

  await d.standupTask.delete({ where: { id: taskId } });
  await logTimeline(task.entryId, `${manager.name ?? "Manager"} removed from yesterday's summary: "${task.text}"`);
  revalidateMember(task.entry.userId);
  return { message: "deleted" };
}
