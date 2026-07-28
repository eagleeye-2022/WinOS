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

  const isManager = session.user.role === "MANAGER";
  const isOwner = session.user.id === entry.userId;

  if (!isManager && !isOwner) {
    return { message: "Unauthorized" };
  }

  if (entry.status === "REVIEWED" && !isManager) {
    return { message: "This entry has already been reviewed and cannot be changed." };
  }

  const maxOrder = entry.supportNeeds.reduce(
    (max: number, s: { order: number }) => Math.max(max, s.order ?? 0),
    -1
  );

  const rawMention = (formData.get("mentionedUserId") as string) || null;
  const rawIds = rawMention ? rawMention.split(",").filter(Boolean) : [];
  const primaryUserId = rawIds[0] ?? null;
  const allUserIdsStr = rawIds.length > 0 ? rawIds.join(",") : null;

  const support = await d.standupSupportNeed.create({
    data: {
      entryId,
      text,
      order: maxOrder + 1,
      mentionedUserId: primaryUserId,
      mentionedUserIds: allUserIdsStr,
    },
  });
  if (rawIds.length > 0 && d.standupSupportNeedMention) {
    await d.standupSupportNeedMention.createMany({
      data: rawIds.map((userId: string) => ({ supportNeedId: support.id, userId })),
    });
  }

  revalidatePath("/support");
  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${entry.userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsm/my");
  return { message: "created" };
}
