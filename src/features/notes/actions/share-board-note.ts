"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr } from "@/lib/action-utils";

export type ShareBoardNoteState = { message?: string };

export async function shareBoardNote(
  _prevState: ShareBoardNoteState,
  formData: FormData
): Promise<ShareBoardNoteState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const noteId = getStr(formData, "noteId");
  const shareUserIdsStr = getStr(formData, "shareUserIds") || "";

  if (!noteId) return { message: "Missing note ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Verify ownership / authorization
  const note = await d.boardNote.findUnique({
    where: { id: noteId },
  });
  if (!note) return { message: "Note not found" };

  if (note.authorId !== session.user.id) {
    return { message: "Unauthorized" };
  }

  const shareUserIds = shareUserIdsStr.split(",").map((s) => s.trim()).filter(Boolean);

  // Clear existing shares and replace
  await d.boardNoteShare.deleteMany({ where: { noteId } });

  if (shareUserIds.length > 0) {
    await d.boardNoteShare.createMany({
      data: shareUserIds.map((userId) => ({
        noteId,
        userId,
      })),
      skipDuplicates: true,
    });
  }

  return { message: "shared" };
}
