"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";

export type ShareBoardState = { message?: string };

export async function shareBoard(
  _prevState: ShareBoardState,
  formData: FormData
): Promise<ShareBoardState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const boardId = getStr(formData, "boardId");
  const shareUserIdsStr = getStr(formData, "shareUserIds") || "";

  if (!boardId) return { message: "Missing board ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const board = await d.board.findUnique({ where: { id: boardId } });
  if (!board) return { message: "Board not found" };

  if (board.ownerId !== session.user.id && session.user.role !== "MANAGER") {
    return { message: "Unauthorized" };
  }

  const shareUserIds = shareUserIdsStr.split(",").map((s) => s.trim()).filter(Boolean);

  // Find all threads in this board
  const threads = await d.thread.findMany({ where: { boardId }, select: { id: true } });

  for (const thread of threads) {
    await d.threadShare.deleteMany({ where: { threadId: thread.id } });
    if (shareUserIds.length > 0) {
      await d.threadShare.createMany({
        data: shareUserIds.map((userId) => ({
          threadId: thread.id,
          userId,
        })),
        skipDuplicates: true,
      });

      const notes = await d.boardNote.findMany({ where: { threadId: thread.id }, select: { id: true } });
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
