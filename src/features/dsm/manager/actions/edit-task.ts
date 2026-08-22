"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type EditTaskState = { message?: string };

export async function editTask(
  _prev: EditTaskState,
  formData: FormData
): Promise<EditTaskState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    return { message: "Unauthorized" };
  }

  const taskId = formData.get("taskId") as string;
  const text = (formData.get("text") as string)?.trim();

  if (!taskId) return { message: "Missing task" };
  if (!text) return { message: "Task text cannot be empty" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Guard: do not allow edits on a reviewed entry
  const existing = await d.standupTask.findUnique({
    where: { id: taskId },
    select: { entry: { select: { userId: true, status: true } } },
  });
  if (!existing) return { message: "Task not found" };
  if (existing.entry.status === "REVIEWED") {
    return { message: "This entry has already been reviewed and cannot be changed." };
  }

  const task = await d.standupTask.update({
    where: { id: taskId },
    data: { text, editedById: session.user.id },
    select: { entry: { select: { userId: true } } },
  });

  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${task.entry.userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsm/my");
  return { message: "updated" };
}
