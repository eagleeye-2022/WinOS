"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type AddTaskAfterReviewState = { message?: string };

/** Lets a team member add a task to their own DSR entry after a manager has reviewed it. */
export async function addTaskAfterReview(
  _prev: AddTaskAfterReviewState,
  formData: FormData
): Promise<AddTaskAfterReviewState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

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
  if (entry.userId !== session.user.id) return { message: "Unauthorized" };
  if (entry.status !== "REVIEWED") {
    return { message: "This entry has not been reviewed yet." };
  }

  const maxOrder = entry.plannedTasks.reduce(
    (max: number, t: { order: number }) => Math.max(max, t.order ?? 0),
    -1
  );

  await d.dsrPlannedTask.create({
    data: {
      dsrEntryId: entryId,
      text,
      order: maxOrder + 1,
      addedAfterReview: true,
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

  await d.dsrTimelineEvent.create({
    data: {
      dsrEntryId: entryId,
      type: "TASK_ADDED",
      label: "Member added a task",
      occurredAt: new Date(),
    },
  });

  revalidatePath("/dsr");
  revalidatePath("/dsr/my");
  revalidatePath(`/dsr/member/${entry.userId}`);
  return { message: "created" };
}
