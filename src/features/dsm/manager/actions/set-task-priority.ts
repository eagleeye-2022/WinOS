"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type SetTaskPriorityState = { message?: string };

export async function setTaskPriority(
  _prev: SetTaskPriorityState,
  formData: FormData
): Promise<SetTaskPriorityState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    return { message: "Unauthorized" };
  }

  const taskId = formData.get("taskId") as string;
  const priority = formData.get("priority") as string | null;

  if (!taskId) return { message: "Missing task" };

  const validPriorities = ["P1", "P2", "P3", ""];
  if (!validPriorities.includes(priority ?? "")) return { message: "Invalid priority" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const task = await d.standupTask.update({
    where: { id: taskId },
    data: { managerPriority: priority || null },
    select: { entry: { select: { userId: true } } },
  });

  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${task.entry.userId}`);
  return { message: "updated" };
}
