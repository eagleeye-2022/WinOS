"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { syncDueDateFromDsm } from "../due-date-sync";
import { linkNoProjectRowsToUnassigned, linkProjectOnlyRowsToNat } from "../manager/nat-rows";

export type AddTaskAfterReviewState = { message?: string };

/** Lets a team member or manager add a task to a standup entry after it has been reviewed. */
export async function addTaskAfterReview(
  _prev: AddTaskAfterReviewState,
  formData: FormData
): Promise<AddTaskAfterReviewState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const entryId = formData.get("entryId") as string;
  const text = (formData.get("text") as string)?.trim();
  const kind = (formData.get("kind") as string) || "TODAY";
  const priority = (formData.get("priority") as string) || null;
  const projectTaskId = (formData.get("projectTaskId") as string)?.trim() || null;
  const projectId = (formData.get("projectId") as string)?.trim() || null;
  const dueDateStr = (formData.get("dueDate") as string)?.trim();
  const dueDate = dueDateStr ? new Date(dueDateStr) : null;

  if (!entryId) return { message: "Missing entry ID" };
  if (!text) return { message: "Task text cannot be empty" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const entry = await d.standupEntry.findUnique({
    where: { id: entryId },
    select: { userId: true, status: true, tasks: { select: { order: true } } },
  });

  if (!entry) return { message: "Entry not found" };
  const isOwner = entry.userId === session.user.id;
  const isManager = (session.user as { role?: string })?.role === "MANAGER";
  if (!isOwner && !isManager) return { message: "Unauthorized" };
  if (entry.status !== "REVIEWED") {
    return { message: "This entry has not been reviewed yet." };
  }

  const maxOrder = entry.tasks.reduce(
    (max: number, t: { order: number }) => Math.max(max, t.order ?? 0),
    -1
  );

  const isParking = priority === "PARKING";
  const resolvedKind = isParking ? "PARKED" : (kind as "TODAY" | "YESTERDAY");

  const created = await d.standupTask.create({
    select: { id: true },
    data: {
      entryId,
      kind: resolvedKind,
      isParked: isParking,
      text,
      priority: isParking ? null : priority,
      managerPriority: isParking ? null : (isManager ? priority : null),
      projectTaskId,
      projectId,
      dueDate,
      order: maxOrder + 1,
      addedAfterReview: true,
      addedById: session.user.id,
    },
  });
  // A due date on a linked row becomes the Srijan task's due date too.
  await syncDueDateFromDsm(projectTaskId, dueDate);

  // No task picked: give the row one the member can run the timer on — in the project's NAT
  // list, or in Unassigned Work when no project is picked either (moved to a project later).
  if (resolvedKind === "TODAY" && !projectTaskId) {
    if (projectId) await linkProjectOnlyRowsToNat([{ id: created.id, text, projectId }], entry.userId);
    else await linkNoProjectRowsToUnassigned([{ id: created.id, text }], entry.userId);
  }

  const userName = session.user.name ?? (isManager ? "Manager" : "Member");
  await d.standupTimelineEvent.create({
    data: {
      entryId,
      type: "TASK_ADDED",
      label: `${userName} added a task: "${text}"`,
      occurredAt: new Date(),
    },
  });

  revalidatePath("/dsm");
  revalidatePath("/dsm/my");
  revalidatePath("/dsm/all");
  revalidatePath(`/dsm/member/${entry.userId}`);
  return { message: "created" };
}
