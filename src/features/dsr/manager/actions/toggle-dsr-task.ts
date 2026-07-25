"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type ToggleDsrTaskState = { message?: string };

export async function toggleDsrTask(
  _prev: ToggleDsrTaskState,
  formData: FormData
): Promise<ToggleDsrTaskState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    return { message: "Unauthorized" };
  }

  const taskId = formData.get("taskId") as string;
  if (!taskId) return { message: "Missing task" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const task = await d.dsrPlannedTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      completed: true,
      dsrEntryId: true,
      dsrEntry: { select: { id: true, userId: true, status: true } },
    },
  });

  if (!task) return { message: "Task not found" };

  // Toggle completion
  const newCompleted = !task.completed;
  await d.dsrPlannedTask.update({
    where: { id: taskId },
    data: { completed: newCompleted },
  });

  // Recalculate entry stats
  const allTasks = await d.dsrPlannedTask.findMany({
    where: { dsrEntryId: task.dsrEntryId },
    select: { completed: true },
  });

  const plannedTaskCount = allTasks.length;
  const completedTaskCount = allTasks.filter((t: { completed: boolean }) => t.completed).length;
  const completionPercent = plannedTaskCount > 0
    ? Math.round((completedTaskCount / plannedTaskCount) * 100)
    : 0;

  await d.dsrEntry.update({
    where: { id: task.dsrEntryId },
    data: {
      plannedTaskCount,
      completedTaskCount,
      completionPercent,
    },
  });

  revalidatePath(`/dsr/member/${task.dsrEntry.userId}`);
  revalidatePath("/dsr/manage");
  revalidatePath("/dsr");
  revalidatePath("/dsr/my");

  return { message: "toggled" };
}
