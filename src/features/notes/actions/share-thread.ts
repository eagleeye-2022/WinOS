"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";

export type ShareThreadState = { message?: string };

export async function shareThread(
  _prevState: ShareThreadState,
  formData: FormData
): Promise<ShareThreadState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const threadId = getStr(formData, "threadId");
  const shareUserIdsStr = getStr(formData, "shareUserIds") || "";

  if (!threadId) return { message: "Missing thread ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Verify thread ownership/authorization
  const thread = await d.thread.findUnique({ where: { id: threadId } });
  if (!thread) return { message: "Thread not found" };

  // Allow authors or managers to share
  if (thread.authorId !== session.user.id) {
    return { message: "Unauthorized" };
  }

  const shareUserIds = shareUserIdsStr.split(",").map((s) => s.trim()).filter(Boolean);
  
  // Clear existing shares and replace or simply add
  await d.threadShare.deleteMany({ where: { threadId } });
  
  if (shareUserIds.length > 0) {
    await d.threadShare.createMany({
      data: shareUserIds.map((userId) => ({
        threadId,
        userId,
      })),
      skipDuplicates: true,
    });

    // Also share all notes currently in the thread with these users so they can see the full thread cards
    const notes = await d.boardNote.findMany({ where: { threadId }, select: { id: true } });
    for (const note of notes) {
      await d.boardNoteShare.createMany({
        data: shareUserIds.map((userId) => ({
          noteId: note.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }
  }

  revalidatePath("/notes");
  revalidatePath("/dsm");
  revalidatePath("/dsr");
  revalidatePath("/dsm/my");
  revalidatePath("/dsr/my");
  revalidatePath("/dsm/all");
  revalidatePath("/dsr/manage");
  return { message: "shared" };
}
