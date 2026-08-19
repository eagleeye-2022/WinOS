"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { toUtcDate } from "@/features/dsm/utils";

export type CreateSupportState = { message?: string; errors?: { text?: string[] } };

export async function createSupport(
  _: CreateSupportState,
  formData: FormData
): Promise<CreateSupportState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { message: "Unauthorized" };
  }
  const currentUserId = session.user.id;

  const text = (formData.get("text") as string)?.trim();
  if (!text) return { message: "Support description cannot be empty" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Get or create today's DSR entry for current user
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let entry = await d.standupEntry.findFirst({
    where: {
      userId: currentUserId,
      date: { gte: today },
    },
    select: { id: true, supportNeeds: { select: { order: true } } },
  });

  if (!entry) {
    entry = await d.standupEntry.create({
      data: {
        userId: currentUserId,
        date: today,
        status: "DRAFT",
        workText: "",
        learningText: "",
      },
      select: { id: true, supportNeeds: { select: { order: true } } },
    });
  }

  const existingOrders = (entry.supportNeeds || []).map((s: { order: number }) => s.order);
  const maxOrder = existingOrders.length > 0 ? Math.max(...existingOrders) : 0;
  const order = maxOrder + 1;

  const rawIds = formData.getAll("mentionedUserIds").map(String).filter(Boolean);

  const support = await d.standupSupportNeed.create({
    data: {
      text,
      resolved: false,
      order,
      entryId: entry.id,
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
        relatedEntryId: entry.id,
      })),
    });
  }

  revalidatePath("/support");
  revalidatePath("/dsm");
  return { message: "created" };
}
