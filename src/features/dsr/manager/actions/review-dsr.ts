"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ReviewDsrState = { message?: string };

/** Mark a DSR entry as reviewed and save manager comment. */
export async function reviewDsr(
  _prev: ReviewDsrState,
  formData: FormData
): Promise<ReviewDsrState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    return { message: "Unauthorized" };
  }

  const entryId = formData.get("entryId") as string;
  const userId = formData.get("userId") as string;
  const managerComment = ((formData.get("managerComment") as string) ?? "").trim() || null;

  if (!entryId) return { message: "Missing entry" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const entry = await d.dsrEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { message: "Not found" };

  if (entry.status === "REVIEWED") return { message: "Already reviewed" };
  if (entry.status !== "SUBMITTED" && entry.status !== "PENDING_REVIEW") {
    return { message: "Entry is not reviewable" };
  }

  const standup = await d.standupEntry.findUnique({
    where: { userId_date: { userId: entry.userId, date: entry.date } },
    select: { status: true },
  });
  if (standup?.status !== "REVIEWED") {
    return { message: "This member's DSM must be reviewed before the DSR can be reviewed." };
  }

  await d.dsrEntry.update({
    where: { id: entryId },
    data: {
      status: "REVIEWED",
      reviewedAt: new Date(),
      reviewedById: session.user.id,
      managerComment,
    },
  });

  // Create APPROVED timeline event
  const existingApproved = await d.dsrTimelineEvent.findFirst({
    where: { dsrEntryId: entryId, type: "APPROVED" },
  });
  if (!existingApproved) {
    await d.dsrTimelineEvent.create({
      data: {
        dsrEntryId: entryId,
        type: "APPROVED",
        label: "Manager Approved",
        occurredAt: new Date(),
      },
    });
  }

  revalidatePath(`/dsr/member/${userId}`);
  revalidatePath("/dsr/manage");
  revalidatePath("/dsr");
  revalidatePath("/dsr/my");
  redirect(`/dsr/member/${userId}?reviewed=1`);
}

/** Create an OPENED event when manager first views a DSR entry. */
export async function createDsrOpenedEvent(entryId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const existing = await d.dsrTimelineEvent.findFirst({
    where: { dsrEntryId: entryId, type: "OPENED" },
  });
  if (existing) return;

  await d.dsrTimelineEvent.create({
    data: {
      dsrEntryId: entryId,
      type: "OPENED",
      label: "Manager Opened",
      occurredAt: new Date(),
    },
  });
}
