"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type EditBlockerState = { message?: string };

export async function editBlocker(
  _prev: EditBlockerState,
  formData: FormData
): Promise<EditBlockerState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { message: "Unauthorized" };
  }

  const blockerId = formData.get("blockerId") as string;
  const text = (formData.get("text") as string)?.trim();
  const priority = (formData.get("priority") as string) || undefined;
  const mentionedUserIdRaw = formData.get("mentionedUserId");

  if (!blockerId) return { message: "Missing blocker ID" };
  if (!text) return { message: "Blocker text cannot be empty" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const existing = await d.standupBlocker.findUnique({
    where: { id: blockerId },
    select: { entry: { select: { userId: true, status: true } } },
  });
  if (!existing) return { message: "Blocker not found" };

  const isManager = session.user.role === "MANAGER";
  const isOwner = session.user.id === existing.entry.userId;

  if (!isManager && !isOwner) {
    return { message: "Unauthorized" };
  }

  if (existing.entry.status === "REVIEWED" && !isManager) {
    return { message: "This entry has already been reviewed and cannot be changed." };
  }

  const dbUser = await d.user.findFirst({
    where: {
      OR: [
        { id: session.user.id },
        ...(session.user.email ? [{ email: session.user.email }] : []),
      ],
    },
    select: { id: true },
  });
  const updateData: { text: string; priority?: "LOW" | "MEDIUM" | "HIGH"; mentionedUserId?: string | null; mentionedUserIds?: string | null; editedById?: string | null } = {
    text,
    editedById: dbUser ? dbUser.id : null,
  };
  if (priority && ["LOW", "MEDIUM", "HIGH"].includes(priority)) {
    updateData.priority = priority as "LOW" | "MEDIUM" | "HIGH";
  }
  if (mentionedUserIdRaw !== null) {
    const rawMention = (mentionedUserIdRaw as string) || "";
    const rawIds = rawMention ? rawMention.split(",").filter(Boolean) : [];
    updateData.mentionedUserId = rawIds[0] ?? null;
    updateData.mentionedUserIds = rawIds.length > 0 ? rawIds.join(",") : null;
    if (d.standupBlockerMention) {
      await d.standupBlockerMention.deleteMany({ where: { blockerId } });
      if (rawIds.length > 0) {
        await d.standupBlockerMention.createMany({
          data: rawIds.map((userId: string) => ({ blockerId, userId })),
        });
      }
    }
  }

  const blocker = await d.standupBlocker.update({
    where: { id: blockerId },
    data: updateData,
    select: { entry: { select: { userId: true } } },
  });

  revalidatePath("/blockers");
  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${blocker.entry.userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsm/my");
  return { message: "updated" };
}
