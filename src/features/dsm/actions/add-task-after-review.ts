"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type AddTaskAfterReviewState = { message?: string };

/** Lets a team member add a task to their own standup entry after a manager has reviewed it. */
export async function addTaskAfterReview(
  _prev: AddTaskAfterReviewState,
  formData: FormData
): Promise<AddTaskAfterReviewState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const entryId = formData.get("entryId") as string;
  const text = (formData.get("text") as string)?.trim();
  const kind = (formData.get("kind") as string) || "TODAY";
  const priority = (formData.get("priority") as string) || "P1";

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

  await d.standupTask.create({
    data: {
      entryId,
      kind: kind as "TODAY" | "YESTERDAY",
      text,
      priority,
      order: maxOrder + 1,
      addedAfterReview: true,
      addedById: session.user.id,
    },
  });

  const userName = session.user.name ?? "Member";
  await d.standupTimelineEvent.create({
    data: {
      entryId,
      type: "TASK_ADDED",
      label: `${userName} added a task`,
      occurredAt: new Date(),
    },
  });

  revalidatePath("/dsm");
  revalidatePath("/dsm/my");
  revalidatePath(`/dsm/member/${entry.userId}`);
  return { message: "created" };
}
