"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { countTasksWithoutProject } from "../../utils";

export type ReviewStandupState = { message?: string };

export async function reviewStandup(
  _prev: ReviewStandupState,
  formData: FormData
): Promise<ReviewStandupState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    return { message: "Unauthorized" };
  }

  const entryId = formData.get("entryId") as string;
  const reviewComment = (formData.get("reviewComment") as string | null) ?? "";

  if (!entryId) return { message: "Missing entry" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const entry = await d.standupEntry.findUnique({
    where: { id: entryId },
    include: { tasks: { where: { kind: "TODAY" }, select: { projectId: true, projectTaskId: true } } },
  });
  if (!entry) return { message: "Not found" };

  // Every one of today's tasks must be linked to a project before the DSM can be reviewed.
  const missing = countTasksWithoutProject(entry.tasks);
  if (missing > 0) {
    return {
      message: `Select a project for every task before reviewing (${missing} task${missing === 1 ? "" : "s"} missing a project).`,
    };
  }

  const dbUser = await d.user.findUnique({ where: { id: session.user.id }, select: { id: true } });

  await d.standupEntry.update({
    where: { id: entryId },
    data: {
      status: "REVIEWED",
      reviewedAt: new Date(),
      reviewedById: dbUser ? dbUser.id : null,
      reviewComment: reviewComment || null,
    },
  });

  const existingApproved = await d.standupTimelineEvent.findFirst({
    where: { entryId, type: "APPROVED" },
  });
  if (!existingApproved) {
    const managerName = dbUser?.name ?? session.user.name ?? "Manager";
    await d.standupTimelineEvent.create({
      data: {
        entryId,
        type: "APPROVED",
        label: `${managerName} Reviewed`,
        occurredAt: new Date(),
      },
    });
  }

  revalidatePath("/dsm");
  revalidatePath("/dsm/my");
  revalidatePath("/dsm/all");
  revalidatePath(`/dsm/member/${entry.userId}`);
  return { message: "reviewed" };
}

/** Create an OPENED event when a manager first views a standup entry. */
export async function createStandupOpenedEvent(entryId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const existing = await d.standupTimelineEvent.findFirst({
    where: { entryId, type: "OPENED" },
  });
  if (existing) return;

  const managerName = session.user.name ?? "Manager";
  await d.standupTimelineEvent.create({
    data: {
      entryId,
      type: "OPENED",
      label: `${managerName} Opened`,
      occurredAt: new Date(),
    },
  });
}
