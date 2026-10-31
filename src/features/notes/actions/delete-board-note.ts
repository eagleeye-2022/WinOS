"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr } from "@/lib/action-utils";
import { canDeleteBoardNote } from "./_utils";

export type DeleteBoardNoteState = { message?: string };

export async function deleteBoardNote(
  _prevState: DeleteBoardNoteState,
  formData: FormData
): Promise<DeleteBoardNoteState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const id = getStr(formData, "id");
  if (!id) return { message: "Missing note ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Verify ownership / authorization
  const note = await d.boardNote.findUnique({
    where: { id },
    select: { authorId: true, thread: { select: { authorId: true, board: { select: { ownerId: true } } } } },
  });
  if (!note) return { message: "Note not found" };

  if (!canDeleteBoardNote(note, session.user.id)) {
    return { message: "Unauthorized" };
  }

  await d.boardNote.delete({
    where: { id },
  });

  return { message: "deleted" };
}
