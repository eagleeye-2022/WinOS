"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr } from "@/lib/action-utils";
import { logNoteActivity } from "../note-activity";
import { NOTE_ACTIVITY } from "../note-activity-utils";

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Verify authorization
  const note = await d.boardNote.findUnique({
    where: { id: noteId },
    select: { authorId: true },
  });
  if (!note) return { message: "Note not found" };

  if (note.authorId !== session.user.id) {
    return { message: "Unauthorized" };
  }

  // Move the card to target column/thread
  await d.boardNote.update({
    where: { id: noteId },
    data: { threadId: targetThreadId },
  });

  const target = await d.thread.findUnique({ where: { id: targetThreadId }, select: { title: true } });
  await logNoteActivity(noteId, session.user.id, NOTE_ACTIVITY.MOVED, { detail: target?.title });

  return { message: "moved" };
}
