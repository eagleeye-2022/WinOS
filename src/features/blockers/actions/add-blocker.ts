"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type AddBlockerState = { message?: string };

export async function addBlocker(
  _prev: AddBlockerState,
  formData: FormData
): Promise<AddBlockerState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { message: "Unauthorized" };
  }

  const entryId = formData.get("entryId") as string;
  const text = (formData.get("text") as string)?.trim();
  const priority = (formData.get("priority") as string) || "MEDIUM";
  const mentionedUserId = (formData.get("mentionedUserId") as string) || null;

  if (!entryId) return { message: "Missing entry ID" };
  if (!text) return { message: "Blocker text cannot be empty" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const entry = await d.standupEntry.findUnique({
    where: { id: entryId },
    select: { userId: true, status: true },
  });

  if (!entry) return { message: "Entry not found" };

  const isManager = session.user.role === "MANAGER";
  const isOwner = session.user.id === entry.userId;

  if (!isManager && !isOwner) {
    return { message: "Unauthorized" };
  }

  if (entry.status === "REVIEWED" && !isManager) {
    return { message: "This entry has already been reviewed and cannot be changed." };
  }

  const rawMention = (formData.get("mentionedUserId") as string) || null;
  const rawIds = rawMention ? rawMention.split(",").filter(Boolean) : [];
  const primaryUserId = rawIds[0] ?? null;
  const allUserIdsStr = rawIds.length > 0 ? rawIds.join(",") : null;

  const blocker = await d.standupBlocker.create({
    data: {
      entryId,
      text,
      priority: ["LOW", "MEDIUM", "HIGH"].includes(priority) ? priority : "MEDIUM",
      mentionedUserId: primaryUserId,
      mentionedUserIds: allUserIdsStr,
    },
  });
  if (rawIds.length > 0 && d.standupBlockerMention) {
    await d.standupBlockerMention.createMany({
      data: rawIds.map((userId: string) => ({ blockerId: blocker.id, userId })),
    });
  }

  revalidatePath("/blockers");
  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${entry.userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsm/my");
  return { message: "created" };
}
