"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateTaskAction } from "@/features/projects/actions/project-actions";
import { updateWhyfiTaskAction } from "@/features/whyfi/actions";
import { LEARNING_PROJECT_CATEGORY } from "@/features/whyfi/constants";
import type { ChecklistCloseBlock } from "@/features/sop-checklists/types";

/**
 * Tick / untick on "What Did You Do Yesterday?" for a task the member logged time on outside
 * their DSM tasks: done → status "Done"; not done → "In Progress" (time was logged, so it was
 * being worked on). Goes through the task's own update action, so its permission rules apply —
 * WhyFi School cards through WhyFi's, project tasks through the Projects module's.
 */
export async function setLoggedTaskDoneAction(
  taskId: string,
  done: boolean
): Promise<{ success: boolean; error?: string; checklistBlock?: ChecklistCloseBlock }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const task = await (db as any).projectTask.findUnique({
    where: { id: taskId },
    select: { id: true, project: { select: { projectCategory: true } } },
  });
  if (!task) return { success: false, error: "This task no longer exists." };

  const status = done ? "Done" : "In Progress";
  const res =
    task.project?.projectCategory === LEARNING_PROJECT_CATEGORY
      ? await updateWhyfiTaskAction(task.id, { status })
      : await updateTaskAction(task.id, { status });
  if (!res.success) {
    return {
      success: false,
      error: ("error" in res && res.error) || "Couldn't update the task.",
      checklistBlock: "checklistBlock" in res ? res.checklistBlock : undefined,
    };
  }

  revalidatePath("/dsm");
  revalidatePath("/dsm/my");
  return { success: true };
}
