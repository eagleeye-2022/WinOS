"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type MarkSupportResolvedState = { message?: string };

export async function markSupportResolved(
  _: MarkSupportResolvedState,
  formData: FormData
): Promise<MarkSupportResolvedState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const supportId = formData.get("supportId") as string;
  const resolvedVal = formData.get("resolved") as string | null;
  if (!supportId) return { message: "Missing id" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const need = await d.standupSupportNeed.findUnique({
    where: { id: supportId },
    select: {
      id: true,
      text: true,
      resolved: true,
      mentionedUserId: true,
      mentionedUserIds: true,
      entry: { select: { userId: true, date: true } },
    },
  });
  if (!need) return { message: "Not found" };

  const isOwner = need.entry.userId === session.user.id;
  const isMentioned =
    need.mentionedUserId === session.user.id ||
    (need.mentionedUserIds && need.mentionedUserIds.includes(session.user.id));
  const isManager = session.user.role === "MANAGER";
  if (!isManager && !isOwner && !isMentioned) return { message: "Unauthorized" };

  const newResolved = resolvedVal !== null ? resolvedVal === "true" : !need.resolved;

  await d.standupSupportNeed.update({
    where: { id: supportId },
    data: { resolved: newResolved },
  });

  // Sync to DsrFollowUpDone if a DSR entry exists for this user and date
  try {
    const dsr = await d.dsrEntry.findUnique({
      where: { userId_date: { userId: need.entry.userId, date: need.entry.date } },
      include: { followUpsDone: true },
    });
    if (dsr) {
      const cleanText = need.text.replace(/^(@\S+\s*)+/, "").trim();
      const existingFu = dsr.followUpsDone.find(
        (fu: { text: string }) =>
          fu.text.trim().toLowerCase() === cleanText.toLowerCase() ||
          fu.text.trim().toLowerCase() === need.text.trim().toLowerCase()
      );
      if (existingFu) {
        await d.dsrFollowUpDone.update({
          where: { id: existingFu.id },
          data: { completed: newResolved },
        });
      } else if (newResolved) {
        await d.dsrFollowUpDone.create({
          data: { dsrEntryId: dsr.id, text: cleanText, completed: true },
        });
      }
    }
  } catch (syncErr) {
    console.error("[markSupportResolved] Error syncing to DsrFollowUpDone:", syncErr);
  }

  revalidatePath("/support");
  revalidatePath("/support-needed");
  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${need.entry.userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsm/my");
  revalidatePath("/dsr");
  return { message: newResolved ? "resolved" : "unresolved" };
}
