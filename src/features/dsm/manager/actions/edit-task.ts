"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { NAT_TASK_LIST_NAME } from "../../utils";

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

  // Managers (the only callers — see the role check above) may edit a task even after the DSM is
  // reviewed; members still can't change a reviewed entry from their side.
  const existing = await d.standupTask.findUnique({
    where: { id: taskId },
    select: { projectTaskId: true, entry: { select: { userId: true, status: true } } },
  });
  if (!existing) return { message: "Task not found" };

  const dataToUpdate: Record<string, unknown> = { text, editedById: session.user.id };

  if (formData.has("projectTaskId")) {
    const ptId = (formData.get("projectTaskId") as string)?.trim() || null;
    dataToUpdate.projectTaskId = ptId;
  }
  if (formData.has("projectId")) {
    dataToUpdate.projectId = (formData.get("projectId") as string)?.trim() || null;
  }
  if (formData.has("dueDate")) {
    const dStr = (formData.get("dueDate") as string)?.trim();
    dataToUpdate.dueDate = dStr ? new Date(dStr) : null;
  }
  if (formData.has("managerPriority")) {
    const p = (formData.get("managerPriority") as string)?.trim() || null;
    if (p === "PARKING") {
      dataToUpdate.kind = "PARKED";
      dataToUpdate.isParked = true;
      dataToUpdate.managerPriority = null;
      dataToUpdate.priority = null;
    } else {
      dataToUpdate.managerPriority = p;
    }
  }

  const task = await d.standupTask.update({
    where: { id: taskId },
    data: dataToUpdate,
    select: { projectTaskId: true, entry: { select: { userId: true } } },
  });

  // Only a NAT task (the "Not Aligned Task (NAT)" list — created from a DSM row with no task
  // picked) is named after its DSM row, so editing the row's text renames that Srijan task too.
  // Tasks in any other list keep their own title; only the DSM row changes.
  if (task.projectTaskId) {
    const linked = await d.projectTask.findUnique({
      where: { id: task.projectTaskId },
      select: { id: true, title: true, projectId: true, phaseName: true, taskListName: true },
    });
    const natName = NAT_TASK_LIST_NAME.toLowerCase();
    const isNatTask =
      !!linked &&
      [linked.taskListName, linked.phaseName].some((n: string | null) => (n || "").trim().toLowerCase() === natName);
    if (linked && isNatTask && linked.title !== text) {
      await d.projectTask.update({
        where: { id: linked.id },
        data: { title: text, lastActivityDate: new Date() },
      });
      const editorName = session.user.name || "Manager";
      await d.projectTaskActivity.create({
        data: {
          userId: session.user.id,
          userName: editorName,
          userInitials: editorName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() || "M",
          actionText: `renamed this task from DSM review ("${linked.title}" → "${text}")`,
          taskId: linked.id,
        },
      });
      revalidatePath("/projects");
      if (linked.projectId) revalidatePath(`/projects/${linked.projectId}`);
    }
  }

  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${task.entry.userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsm/my");
  return { message: "updated" };
}
