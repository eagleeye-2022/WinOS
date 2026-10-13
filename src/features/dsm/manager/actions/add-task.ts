"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { linkProjectOnlyRowsToNat } from "../nat-rows";

export type AddTaskState = { message?: string };

export async function addTask(
  _prev: AddTaskState,
  formData: FormData
): Promise<AddTaskState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    return { message: "Unauthorized" };
  }

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

  const addedAfterReview = entry.status === "REVIEWED";

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
      managerPriority: isParking ? null : priority,
      projectTaskId,
      projectId,
      dueDate,
      order: maxOrder + 1,
      addedAfterReview,
      addedById: session.user.id,
    },
  });

  // Added to an already-reviewed DSM with a project but no task: there's no later review to
  // create its NAT task, so do it now (see reviewStandup).
  if (addedAfterReview && resolvedKind === "TODAY" && projectId && !projectTaskId) {
    await linkProjectOnlyRowsToNat([{ id: created.id, text, projectId }], entry.userId);
  }

  const managerName = session.user.name ?? "Manager";
  await d.standupTimelineEvent.create({
    data: {
      entryId,
      type: "TASK_ADDED",
      label: `${managerName} added a task: "${text}"`,
      occurredAt: new Date(),
    },
  });

  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${entry.userId}`);
  revalidatePath("/dsm/all");
  return { message: "created" };
}
