"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type MarkBlockerResolvedState = { message?: string };

export async function markBlockerResolved(
  _: MarkBlockerResolvedState,
  formData: FormData
): Promise<MarkBlockerResolvedState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const blockerId = formData.get("blockerId") as string;
  const resolvedVal = formData.get("resolved") as string | null;
  if (!blockerId) return { message: "Missing id" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const blocker = await d.standupBlocker.findUnique({
    where: { id: blockerId },
    select: {
      id: true,
      text: true,
      resolved: true,
      mentionedUserId: true,
      mentionedUserIds: true,
      entry: { select: { userId: true, date: true } },
    },
  });
  if (!blocker) return { message: "Not found" };

  const isOwner = blocker.entry.userId === session.user.id;
  const isMentioned =
    blocker.mentionedUserId === session.user.id ||
    (blocker.mentionedUserIds && blocker.mentionedUserIds.includes(session.user.id));
  const isManager = session.user.role === "MANAGER";
  if (!isManager && !isOwner && !isMentioned) return { message: "Unauthorized" };

  const newResolved = resolvedVal !== null ? resolvedVal === "true" : !blocker.resolved;

  await d.standupBlocker.update({
    where: { id: blockerId },
    data: { resolved: newResolved },
  });

  // Sync to DsrResolvedBlocker if a DSR entry exists for this user and date
  try {
    const dsr = await d.dsrEntry.findUnique({
      where: { userId_date: { userId: blocker.entry.userId, date: blocker.entry.date } },
      include: { resolvedBlockers: true },
    });
    if (dsr) {
      const cleanText = blocker.text.replace(/^(@\S+\s*)+/, "").trim();
      const existingRb = dsr.resolvedBlockers.find(
        (rb: { text: string }) =>
          rb.text.trim().toLowerCase() === cleanText.toLowerCase() ||
          rb.text.trim().toLowerCase() === blocker.text.trim().toLowerCase()
      );
      if (existingRb) {
        await d.dsrResolvedBlocker.update({
          where: { id: existingRb.id },
          data: { resolved: newResolved },
        });
      } else if (newResolved) {
        await d.dsrResolvedBlocker.create({
          data: { dsrEntryId: dsr.id, text: cleanText, resolved: true },
        });
      }
    }
  } catch (syncErr) {
    console.error("[markBlockerResolved] Error syncing to DsrResolvedBlocker:", syncErr);
  }

  revalidatePath("/blockers");
  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${blocker.entry.userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsm/my");
  revalidatePath("/dsr");
  return { message: newResolved ? "resolved" : "unresolved" };
}
