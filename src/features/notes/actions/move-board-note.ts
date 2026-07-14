"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getStr } from "@/lib/action-utils";

export type MoveBoardNoteState = { message?: string };

export async function moveBoardNote(
  _prevState: MoveBoardNoteState,
  formData: FormData
): Promise<MoveBoardNoteState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const noteId = getStr(formData, "noteId");
  const targetThreadId = getStr(formData, "targetThreadId");

  if (!noteId || !targetThreadId) return { message: "Missing fields" };

  const d = db as any;

  // Verify authorization
  const note = await d.boardNote.findUnique({
    where: { id: noteId },
    select: { authorId: true },
  });
  if (!note) return { message: "Note not found" };

  const isManager = session.user.role === "MANAGER";
  if (note.authorId !== session.user.id && !isManager) {
    return { message: "Unauthorized" };
  }

  // Move the card to target column/thread
  await d.boardNote.update({
    where: { id: noteId },
    data: { threadId: targetThreadId },
  });

  return { message: "moved" };
}
