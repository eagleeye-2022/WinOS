"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

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
