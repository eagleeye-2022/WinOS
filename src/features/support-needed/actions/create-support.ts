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
  if (!session?.user?.id) return { message: "Unauthorized" };

  const text = (formData.get("text") as string)?.trim();

  if (!text) return { errors: { text: ["Description is required"] } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const today = toUtcDate();

  const entry = await d.standupEntry.upsert({
    where: { userId_date: { userId: session.user.id, date: today } },
    create: { userId: session.user.id, date: today, status: "DRAFT" },
    update: {},
  });

  if (entry.status === "REVIEWED") {
    return { message: "Today's standup is already reviewed." };
  }

  const rawMention = (formData.get("mentionedUserId") as string) || null;
  const rawIds = rawMention ? rawMention.split(",").filter(Boolean) : [];
  const primaryUserId = rawIds[0] ?? null;
  const allUserIdsStr = rawIds.length > 0 ? rawIds.join(",") : null;

  const order = await d.standupSupportNeed.count({ where: { entryId: entry.id } });

  const support = await d.standupSupportNeed.create({
    data: {
      text,
      mentionedUserId: primaryUserId,
      mentionedUserIds: allUserIdsStr,
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

  revalidatePath("/support");
  revalidatePath("/dsm");
  return { message: "created" };
}
