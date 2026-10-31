"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { canCloseWithoutSop, checklistCloseBlock, forcedCloseOf } from "@/features/sop-checklists/close-gate";
import { recordTaskClosed } from "@/features/sop-checklists/events";
import { isTaskDone } from "@/features/projects/types";
import { openSubtasksOf, openSubtasksMessage } from "@/features/projects/subtask-gate";

export async function toggleStandupTask(taskId: string, isCompleted: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  try {
    const task = await d.standupTask.findUnique({
      where: { id: taskId },
      select: { id: true, projectTaskId: true, text: true },
    });

    if (!task) return { success: false, message: "Task not found" };

    // Completing it closes the linked Srijan task, which needs a completed SOP checklist first —
    // managers may skip it (recorded as forced) — unless that task is already closed.
    const linked = isCompleted && task.projectTaskId
      ? await d.projectTask.findUnique({
          where: { id: task.projectTaskId },
          select: { status: true, completionPercentage: true },
        })
      : null;
    let sopBlock: Awaited<ReturnType<typeof checklistCloseBlock>> = null;
    if (isCompleted && task.projectTaskId && linked && !isTaskDone(linked.status, false, linked.completionPercentage)) {
      // Its subtasks (any depth) must be done first.
      const openSubs = await openSubtasksOf(task.projectTaskId);
      if (openSubs.length > 0) return { success: false, message: openSubtasksMessage(openSubs, "close") };
      sopBlock = await checklistCloseBlock(task.projectTaskId);
      if (sopBlock && !(await canCloseWithoutSop(session.user.id))) {
        return {
          success: false,
          message: sopBlock.message,
          // No "Close anyway" for team members.
          checklistBlock: { ...sopBlock, canForce: false },
        };
      }
    }

    await d.standupTask.update({
      where: { id: taskId },
      data: { isCompleted },
    });

    if (task.projectTaskId) {
      if (isCompleted) {
        await d.projectTask.update({
          where: { id: task.projectTaskId },
          data: {
            completionPercentage: 100,
            status: "Closed",
            lastActivityDate: new Date(),
          },
        });

        const userName = session.user.name ?? "User";
        const initials = userName
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        await d.projectTaskActivity.create({
          data: {
            taskId: task.projectTaskId,
            userId: session.user.id,
            userName,
            userInitials: initials || "U",
            actionText: `completed standup task: "${task.text}" (synced status to Closed)`,
          },
        });

        // SOP timeline: the linked task was closed (forced when a manager skipped the checklist).
        if (linked && !isTaskDone(linked.status, false, linked.completionPercentage)) {
          await recordTaskClosed(
            { id: session.user.id, name: userName },
            task.projectTaskId,
            sopBlock ? forcedCloseOf(sopBlock) : null
          );
        }
      }
    }

    revalidatePath("/dsm");
    revalidatePath("/dsm/my");
    revalidatePath("/projects");

    return { success: true };
  } catch (error) {
    console.error("[toggleStandupTask] Error:", error);
    return { success: false, message: "Failed to update task completion" };
  }
}
