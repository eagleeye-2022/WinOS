"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { isoToUtcDate, toUtcDate } from "../utils";
import { parseRule, serializeRule, type RecurrenceRule } from "../recurring-utils";
import { syncRecurrenceFromDsm } from "../recurrence-sync";

export type RecurringTaskActionResult = {
  success: boolean;
  message?: string;
  id?: string;
};

async function resolveEffectiveUserId(targetUserId?: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role === "MANAGER" && targetUserId) {
    return { callerId: session.user.id, callerRole: session.user.role, effectiveUserId: targetUserId };
  }
  return { callerId: session.user.id, callerRole: session.user.role, effectiveUserId: session.user.id };
}

function revalidateDsmPaths(targetUserId?: string) {
  revalidatePath("/dsm");
  revalidatePath("/dsm/my");
  revalidatePath("/dsm/all");
  if (targetUserId) {
    revalidatePath(`/dsm/member/${targetUserId}`);
  }
}

export async function createRecurringTaskAction(input: {
  text: string;
  priority?: string | null;
  projectId?: string | null;
  projectTaskId?: string | null;
  rule: RecurrenceRule;
  startDateStr?: string;
  endDateStr?: string | null;
  targetUserId?: string;
}): Promise<RecurringTaskActionResult> {
  const ctx = await resolveEffectiveUserId(input.targetUserId);
  if (!ctx) return { success: false, message: "Unauthorized" };

  const text = input.text?.trim();
  if (!text) return { success: false, message: "Task description is required" };

  const serialized = serializeRule(input.rule);
  if (!serialized) return { success: false, message: "Invalid recurrence rule" };

  const startDate = input.startDateStr ? isoToUtcDate(input.startDateStr) : toUtcDate();
  const endDate = input.endDateStr ? isoToUtcDate(input.endDateStr) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const count = await d.recurringStandupTask.count({ where: { userId: ctx.effectiveUserId } });

  const created = await d.recurringStandupTask.create({
    data: {
      userId: ctx.effectiveUserId,
      createdById: ctx.callerId,
      text,
      priority: input.priority || null,
      projectId: input.projectId || null,
      projectTaskId: input.projectTaskId || null,
      recurrenceRule: serialized,
      startDate,
      endDate,
      isActive: true,
      order: count,
    },
    select: { id: true },
  });

  // Linked to a Srijan task → that task (and other people's templates for it) repeat the same way.
  await syncRecurrenceFromDsm(input.projectTaskId, serialized);

  revalidateDsmPaths(ctx.effectiveUserId);
  return { success: true, id: created.id };
}

export async function updateRecurringTaskAction(
  id: string,
  input: {
    text?: string;
    priority?: string | null;
    projectId?: string | null;
    projectTaskId?: string | null;
    rule?: RecurrenceRule;
    isActive?: boolean;
  }
): Promise<RecurringTaskActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const existing = await d.recurringStandupTask.findUnique({
    where: { id },
    select: { id: true, userId: true, projectTaskId: true, recurrenceRule: true, isActive: true },
  });
  if (!existing) return { success: false, message: "Recurring task not found" };
  if (existing.userId !== session.user.id && session.user.role !== "MANAGER") {
    return { success: false, message: "Forbidden" };
  }

  let serializedRule: string | undefined;
  if (input.rule) {
    const s = serializeRule(input.rule);
    if (!s || !parseRule(s)) return { success: false, message: "Invalid recurrence rule" };
    serializedRule = s;
  }

  await d.recurringStandupTask.update({
    where: { id },
    data: {
      ...(input.text !== undefined ? { text: input.text.trim() } : {}),
      ...(input.priority !== undefined ? { priority: input.priority || null } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId || null } : {}),
      ...(input.projectTaskId !== undefined ? { projectTaskId: input.projectTaskId || null } : {}),
      ...(serializedRule !== undefined ? { recurrenceRule: serializedRule } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  // A schedule change, pause or resume on a template linked to a Srijan task applies to that task
  // and to everyone else's template for it (paused here = off everywhere).
  if (serializedRule !== undefined || input.isActive !== undefined) {
    const linkedTaskId = input.projectTaskId !== undefined ? input.projectTaskId || null : existing.projectTaskId;
    const nowActive = input.isActive ?? existing.isActive;
    await syncRecurrenceFromDsm(linkedTaskId, nowActive ? serializedRule ?? existing.recurrenceRule : null);
  }

  revalidateDsmPaths(existing.userId);
  return { success: true, id };
}

export async function toggleRecurringTaskAction(
  id: string,
  isActive: boolean
): Promise<RecurringTaskActionResult> {
  return updateRecurringTaskAction(id, { isActive });
}

export async function deleteRecurringTaskAction(id: string): Promise<RecurringTaskActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const existing = await d.recurringStandupTask.findUnique({
    where: { id },
    select: { id: true, userId: true, projectTaskId: true },
  });
  if (!existing) return { success: false, message: "Recurring task not found" };
  if (existing.userId !== session.user.id && session.user.role !== "MANAGER") {
    return { success: false, message: "Forbidden" };
  }

  await d.recurringStandupTask.delete({ where: { id } });
  // Deleting a linked template turns the Srijan task's recurrence off (others' templates pause).
  await syncRecurrenceFromDsm(existing.projectTaskId, null);
  revalidateDsmPaths(existing.userId);
  return { success: true, id };
}

export async function skipRecurringTaskForDateAction(
  recurringTaskId: string,
  dateStr: string
): Promise<RecurringTaskActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const existing = await d.recurringStandupTask.findUnique({
    where: { id: recurringTaskId },
    select: { id: true, userId: true },
  });
  if (!existing) return { success: false, message: "Recurring task not found" };
  if (existing.userId !== session.user.id && session.user.role !== "MANAGER") {
    return { success: false, message: "Forbidden" };
  }

  const date = isoToUtcDate(dateStr);
  await d.standupRecurringSkip.upsert({
    where: { recurringTaskId_date: { recurringTaskId, date } },
    create: { recurringTaskId, date },
    update: {},
  });

  revalidateDsmPaths(existing.userId);
  return { success: true, id: recurringTaskId };
}

export async function setStandupTaskRecurrenceAction(
  standupTaskId: string,
  rule: RecurrenceRule | null
): Promise<RecurringTaskActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const task = await d.standupTask.findUnique({
    where: { id: standupTaskId },
    select: {
      id: true,
      text: true,
      priority: true,
      projectId: true,
      projectTaskId: true,
      recurringTaskId: true,
      entry: { select: { userId: true, date: true } },
    },
  });
  if (!task) return { success: false, message: "Task not found" };
  if (task.entry.userId !== session.user.id && session.user.role !== "MANAGER") {
    return { success: false, message: "Forbidden" };
  }

  if (!rule) {
    // Turning recurrence off pauses the template instead of deleting it, so past days keep their
    // link and it can be resumed (or deleted on purpose) from the recurring-tasks manager.
    if (task.recurringTaskId) {
      await d.recurringStandupTask.update({
        where: { id: task.recurringTaskId },
        data: { isActive: false },
      });
      await d.standupTask.update({ where: { id: standupTaskId }, data: { recurringTaskId: null } });
      await syncRecurrenceFromDsm(task.projectTaskId, null);
    }
    revalidateDsmPaths(task.entry.userId);
    return { success: true };
  }

  const serialized = serializeRule(rule);
  if (!serialized) return { success: false, message: "Invalid recurrence rule" };

  if (task.recurringTaskId) {
    await d.recurringStandupTask.update({
      where: { id: task.recurringTaskId },
      data: { recurrenceRule: serialized, isActive: true },
    });
    await syncRecurrenceFromDsm(task.projectTaskId, serialized);
    revalidateDsmPaths(task.entry.userId);
    return { success: true, id: task.recurringTaskId };
  }

  const count = await d.recurringStandupTask.count({ where: { userId: task.entry.userId } });
  const created = await d.recurringStandupTask.create({
    data: {
      userId: task.entry.userId,
      createdById: session.user.id,
      text: task.text,
      priority: task.priority || null,
      projectId: task.projectId || null,
      projectTaskId: task.projectTaskId || null,
      recurrenceRule: serialized,
      startDate: task.entry.date,
      isActive: true,
      order: count,
    },
    select: { id: true },
  });
  await d.standupTask.update({
    where: { id: standupTaskId },
    data: { recurringTaskId: created.id },
  });
  await syncRecurrenceFromDsm(task.projectTaskId, serialized);

  revalidateDsmPaths(task.entry.userId);
  return { success: true, id: created.id };
}
