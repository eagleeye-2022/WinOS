"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type EditSupportState = { message?: string };

export async function editSupport(
  _prev: EditSupportState,
  formData: FormData
): Promise<EditSupportState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { message: "Unauthorized" };
  }

  const supportId = formData.get("supportId") as string;
  const text = (formData.get("text") as string)?.trim();
  const mentionedUserIdRaw = formData.get("mentionedUserId");

  if (!supportId) return { message: "Missing support ID" };
  if (!text) return { message: "Support description cannot be empty" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const existing = await d.standupSupportNeed.findUnique({
    where: { id: supportId },
    select: { entry: { select: { userId: true, status: true } } },
  });
  if (!existing) return { message: "Support item not found" };

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
  const updateData: { text: string; mentionedUserId?: string | null; mentionedUserIds?: string | null; editedById?: string | null } = {
    text,
    editedById: dbUser ? dbUser.id : null,
  };
  if (mentionedUserIdRaw !== null) {
    const rawMention = (mentionedUserIdRaw as string) || "";
    const rawIds = rawMention ? rawMention.split(",").filter(Boolean) : [];
    updateData.mentionedUserId = rawIds[0] ?? null;
    updateData.mentionedUserIds = rawIds.length > 0 ? rawIds.join(",") : null;
    if (d.standupSupportNeedMention) {
      await d.standupSupportNeedMention.deleteMany({ where: { supportNeedId: supportId } });
      if (rawIds.length > 0) {
        await d.standupSupportNeedMention.createMany({
          data: rawIds.map((userId: string) => ({ supportNeedId: supportId, userId })),
        });
      }
    }
  }

  const need = await d.standupSupportNeed.update({
    where: { id: supportId },
    data: updateData,
    select: { entry: { select: { userId: true } } },
  });

  revalidatePath("/support");
  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${need.entry.userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsm/my");
  return { message: "updated" };
}
