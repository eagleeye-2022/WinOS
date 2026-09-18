"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { toUtcDate } from "../utils";

export type ParkedTaskResult = {
  success: boolean;
  message?: string;
  task?: {
    id: string;
    text: string;
    priority: string | null;
    projectTaskId: string | null;
    dueDate: Date | null;
  };
};

/** Finds (or lazily creates) today's DRAFT entry — parking a task shouldn't require the day's DSM to already exist. */
async function ensureTodayEntry(userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const today = toUtcDate();
  return d.standupEntry.upsert({
    where: { userId_date: { userId, date: today } },
    create: { userId, date: today, status: "DRAFT" },
    update: {},
    select: { id: true },
  });
}

/** Adds a new task straight to the parking lot (the "+ Park Task" row). */
export async function parkNewTask(input: {
  text: string;
  priority?: string;
  projectTaskId?: string;
  dueDate?: string;
  targetUserId?: string;
}): Promise<ParkedTaskResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const text = input.text?.trim();
  if (!text) return { success: false, message: "Task text is required" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const effectiveUserId = (session.user.role === "MANAGER" && input.targetUserId) ? input.targetUserId : session.user.id;
  const entry = await ensureTodayEntry(effectiveUserId);
  const parkedCount = await d.standupTask.count({ where: { entryId: entry.id, kind: "PARKED" } });

  const task = await d.standupTask.create({
    data: {
      entryId: entry.id,
      kind: "PARKED",
      isParked: true,
      text,
      priority: input.priority || null,
      projectTaskId: input.projectTaskId || null,
      dueDate: input.dueDate ? new Date(input.dueDate + "T00:00:00.000Z") : null,
      order: parkedCount,
      addedById: session.user.id,
    },
    select: { id: true, text: true, priority: true, projectTaskId: true, dueDate: true },
  });

  revalidatePath("/dsm");
  revalidatePath("/dsm/my");
  revalidatePath(`/dsm/member/${effectiveUserId}`);
  revalidatePath("/dsm/all");
  return { success: true, task };
}

/** Verifies the calling user owns the given parked task (or is a manager); returns it or null. */
async function loadOwnedParkedTask(taskId: string, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const task = await d.standupTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      kind: true,
      text: true,
      priority: true,
      projectTaskId: true,
      dueDate: true,
      entry: { select: { id: true, userId: true } },
    },
  });
  if (!task || task.kind !== "PARKED") return null;
  if (task.entry.userId !== userId) {
    const user = await d.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role !== "MANAGER") return null;
  }
  return task;
}

/** Edits a parked task's fields (priority / linked project task / due date / text). */
export async function updateParkedTask(
  taskId: string,
  input: { text?: string; priority?: string; projectTaskId?: string; dueDate?: string }
): Promise<ParkedTaskResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const owned = await loadOwnedParkedTask(taskId, session.user.id);
  if (!owned) return { success: false, message: "Task not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const task = await d.standupTask.update({
    where: { id: taskId },
    data: {
      ...(input.text !== undefined ? { text: input.text.trim() } : {}),
      ...(input.priority !== undefined ? { priority: input.priority || null } : {}),
      ...(input.projectTaskId !== undefined ? { projectTaskId: input.projectTaskId || null } : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate + "T00:00:00.000Z") : null }
        : {}),
    },
    select: { id: true, text: true, priority: true, projectTaskId: true, dueDate: true },
  });

  revalidatePath("/dsm");
  revalidatePath("/dsm/my");
  revalidatePath(`/dsm/member/${owned.entry.userId}`);
  revalidatePath("/dsm/all");
  return { success: true, task };
}

/** Removes a task from the parking lot entirely. */
export async function removeParkedTask(taskId: string): Promise<{ success: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const owned = await loadOwnedParkedTask(taskId, session.user.id);
  if (!owned) return { success: false, message: "Task not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  await d.standupTask.delete({ where: { id: taskId } });

  revalidatePath("/dsm");
  revalidatePath("/dsm/my");
  revalidatePath(`/dsm/member/${owned.entry.userId}`);
  revalidatePath("/dsm/all");
  return { success: true };
}

/** Moves a parked task onto today's "What Will You Do Today?" list, and optionally records it as completed in today's DSR. */
export async function moveParkedTaskToToday(
  taskId: string,
  options?: { markCompletedInDsr?: boolean }
): Promise<ParkedTaskResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const owned = await loadOwnedParkedTask(taskId, session.user.id);
  if (!owned) return { success: false, message: "Task not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const entry = await ensureTodayEntry(owned.entry.userId);
  const todayCount = await d.standupTask.count({ where: { entryId: entry.id, kind: "TODAY" } });

  const task = await d.standupTask.update({
    where: { id: taskId },
    data: {
      entryId: entry.id,
      kind: "TODAY",
      isParked: false,
      order: todayCount,
    },
    select: { id: true, text: true, priority: true, projectTaskId: true, dueDate: true },
  });

  if (options?.markCompletedInDsr) {
    const today = toUtcDate();
    const VALID_ENUM_PRIORITIES = new Set(["P1", "P2", "P3"]);
    const cleanPriority = task.priority && VALID_ENUM_PRIORITIES.has(task.priority.toUpperCase())
      ? task.priority.toUpperCase()
      : null;

    let dsrEntry = await d.dsrEntry.findUnique({
      where: { userId_date: { userId: owned.entry.userId, date: today } },
      include: { plannedTasks: true },
    });

    if (!dsrEntry) {
      type StandupTaskItem = { id: string; text: string; priority?: string | null };
      type PlannedItem = { text: string; priority: string | null; completed: boolean; order: number };

      // Create initial draft DSR entry populated from today's standup tasks
      const standupTasks: StandupTaskItem[] = await d.standupTask.findMany({
        where: { entryId: entry.id, kind: "TODAY" },
        orderBy: { order: "asc" },
      });

      const plannedData: PlannedItem[] = standupTasks.map((st, i) => {
        const p = st.priority && VALID_ENUM_PRIORITIES.has(st.priority.toUpperCase()) ? st.priority.toUpperCase() : null;
        return {
          text: st.text,
          priority: p,
          completed: st.id === taskId,
          order: i,
        };
      });

      const compCount = plannedData.filter((t) => t.completed).length;
      const totalCount = plannedData.length;
      const compPct = totalCount > 0 ? Math.round((compCount / totalCount) * 100) : 0;

      dsrEntry = await d.dsrEntry.create({
        data: {
          userId: owned.entry.userId,
          date: today,
          status: "DRAFT",
          plannedTaskCount: totalCount,
          completedTaskCount: compCount,
          completionPercent: compPct,
          plannedTasks: {
            create: plannedData,
          },
        },
        include: { plannedTasks: true },
      });
    } else {
      type DsrTaskItem = { id: string; text: string; completed: boolean };
      const alreadyExists = (dsrEntry.plannedTasks as DsrTaskItem[]).some(
        (pt) => pt.text.trim().toLowerCase() === task.text.trim().toLowerCase()
      );

      if (!alreadyExists) {
        const plannedOrder = dsrEntry.plannedTasks.length;
        await d.dsrPlannedTask.create({
          data: {
            dsrEntryId: dsrEntry.id,
            text: task.text,
            priority: cleanPriority,
            completed: true,
            order: plannedOrder,
          },
        });
      } else {
        await d.dsrPlannedTask.updateMany({
          where: {
            dsrEntryId: dsrEntry.id,
            text: task.text,
          },
          data: { completed: true },
        });
      }

      const allPlanned: DsrTaskItem[] = await d.dsrPlannedTask.findMany({ where: { dsrEntryId: dsrEntry.id } });
      const compCount = allPlanned.filter((t) => t.completed).length;
      const totalCount = allPlanned.length;
      const compPct = totalCount > 0 ? Math.round((compCount / totalCount) * 100) : 0;

      await d.dsrEntry.update({
        where: { id: dsrEntry.id },
        data: {
          plannedTaskCount: totalCount,
          completedTaskCount: compCount,
          completionPercent: compPct,
        },
      });
    }
  }

  revalidatePath("/dsm");
  revalidatePath("/dsm/my");
  revalidatePath(`/dsm/member/${owned.entry.userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsr");
  revalidatePath("/dsr/my");
  revalidatePath(`/dsr/member/${owned.entry.userId}`);
  revalidatePath("/dsr/manage");
  return { success: true, task };
}
