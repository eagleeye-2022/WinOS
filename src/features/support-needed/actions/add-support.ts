"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type AddSupportState = { message?: string };

export async function addSupport(
  _prev: AddSupportState,
  formData: FormData
): Promise<AddSupportState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { message: "Unauthorized" };
  }
  const currentUserId = session.user.id;

  const entryId = formData.get("entryId") as string;
  const text = (formData.get("text") as string)?.trim();

  if (!entryId) return { message: "Missing entry ID" };
  if (!text) return { message: "Support description cannot be empty" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const entry = await d.standupEntry.findUnique({
    where: { id: entryId },
    select: { userId: true, status: true, supportNeeds: { select: { order: true } } },
  });

  if (!entry) return { message: "Entry not found" };

  const isOwner = entry.userId === currentUserId;
  const isManager = (session.user as { role?: string })?.role === "MANAGER";

  if (!isOwner && !isManager) {
    return { message: "Forbidden" };
  }

  const existingOrders = (entry.supportNeeds || []).map((s: { order: number }) => s.order);
  const maxOrder = existingOrders.length > 0 ? Math.max(...existingOrders) : 0;
  const order = maxOrder + 1;

  const rawIds = ((formData.get("mentionedUserId") as string) || "").split(",").filter(Boolean);
  const eventId = (formData.get("eventId") as string)?.trim() || null;

  const support = await d.standupSupportNeed.create({
    data: {
      text,
      resolved: false,
      order,
      entryId,
      mentionedUserId: rawIds[0] ?? null,
      mentionedUserIds: rawIds.length > 0 ? rawIds.join(",") : null,
      eventId,
    },
  });
  if (rawIds.length > 0 && d.standupSupportNeedMention) {
    await d.standupSupportNeedMention.createMany({
      data: rawIds.map((userId: string) => ({ supportNeedId: support.id, userId })),
    });
  }

  const notifyIds = rawIds.filter((id: string) => id !== currentUserId);
  if (notifyIds.length > 0) {
    await d.notification.createMany({
      data: notifyIds.map((userId: string) => ({
        type: "DSM_REMINDER",
        title: "Support Needed (Meeting) Request",
        message: `You were tagged for support: "${text.slice(0, 80)}".`,
        userId,
        createdById: currentUserId,
        relatedEntryId: entryId,
      })),
    });
  }

  revalidatePath("/support");
  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${entry.userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsm/my");
  return { message: "created" };
}
