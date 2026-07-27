"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type SetTaskPriorityState = { message?: string };

// Validate format: empty string (clear) or "P" followed by a positive integer (P1, P2, P3, P4, ...)
function isValidPriority(p: string): boolean {
  if (p === "") return true;
  return /^P[1-9]\d*$/.test(p);
}

export async function setTaskPriority(
  _prev: SetTaskPriorityState,
  formData: FormData
): Promise<SetTaskPriorityState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    return { message: "Unauthorized" };
  }

  const taskId = formData.get("taskId") as string;
  const priority = (formData.get("priority") as string) ?? "";

  if (!taskId) return { message: "Missing task" };
  if (!isValidPriority(priority)) return { message: "Invalid priority format" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Fetch this task and all sibling tasks in the same entry
  const task = await d.standupTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      entry: {
        select: {
          userId: true,
          status: true,
          tasks: { select: { id: true, managerPriority: true } },
        },
      },
    },
  });

  if (!task) return { message: "Task not found" };

  // Guard: reviewed entries are locked
  if (task.entry.status === "REVIEWED") {
    return { message: "This entry has already been reviewed and cannot be changed." };
  }

  // Guard: uniqueness — if assigning a priority, ensure no sibling already holds it
  if (priority !== "") {
    const conflict = task.entry.tasks.find(
      (t: { id: string; managerPriority: string | null }) =>
        t.id !== taskId && t.managerPriority === priority
    );
    if (conflict) {
      return { message: `${priority} is already assigned to another task in this entry.` };
    }
  }

  await d.standupTask.update({
    where: { id: taskId },
    data: { managerPriority: priority || null },
  });

  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${task.entry.userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsm/my");
  return { message: "updated" };
}
