"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type AddDsrTaskState = { message?: string };

export async function addDsrTask(
  _prev: AddDsrTaskState,
  formData: FormData
): Promise<AddDsrTaskState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    return { message: "Unauthorized" };
  }

  const entryId = formData.get("entryId") as string;
  const text = (formData.get("text") as string)?.trim();

  if (!entryId) return { message: "Missing entry ID" };
  if (!text) return { message: "Task text cannot be empty" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const entry = await d.dsrEntry.findUnique({
    where: { id: entryId },
    select: {
      userId: true,
      status: true,
      plannedTasks: { select: { order: true, completed: true } },
    },
  });

  if (!entry) return { message: "Entry not found" };

  const addedAfterReview = entry.status === "REVIEWED";

  const maxOrder = entry.plannedTasks.reduce(
    (max: number, t: { order: number }) => Math.max(max, t.order ?? 0),
    -1
  );

  await d.dsrPlannedTask.create({
    data: {
      dsrEntryId: entryId,
      text,
      order: maxOrder + 1,
      addedAfterReview,
    },
  });

  const plannedTaskCount = entry.plannedTasks.length + 1;
  const completedTaskCount = entry.plannedTasks.filter((t: { completed: boolean }) => t.completed).length;
  const completionPercent = plannedTaskCount > 0
    ? Math.round((completedTaskCount / plannedTaskCount) * 100)
    : 0;

  await d.dsrEntry.update({
    where: { id: entryId },
    data: { plannedTaskCount, completedTaskCount, completionPercent },
  });

  const managerName = session.user.name ?? "Manager";
  await d.dsrTimelineEvent.create({
    data: {
      dsrEntryId: entryId,
      type: "TASK_ADDED",
      label: `${managerName} added a task`,
      occurredAt: new Date(),
    },
  });

  revalidatePath(`/dsr/member/${entry.userId}`);
  revalidatePath("/dsr/manage");
  revalidatePath("/dsr");
  revalidatePath("/dsr/my");
  return { message: "created" };
}
