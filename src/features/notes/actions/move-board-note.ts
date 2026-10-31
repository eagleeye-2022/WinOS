"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr } from "@/lib/action-utils";
import { logNoteActivity } from "../note-activity";
import { NOTE_ACTIVITY } from "../note-activity-utils";
import { boardNoteAccessInclude, canEditBoardNote, loadEditableThread } from "./_utils";

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

  const user = { id: session.user.id, role: session.user.role };

  // Verify authorization: the user must be able to edit the card…
  const note = await d.boardNote.findUnique({
    where: { id: noteId },
    include: boardNoteAccessInclude(session.user.id),
  });
  if (!note) return { message: "Note not found" };
  if (!(await canEditBoardNote(note, user))) return { message: "Unauthorized" };

  // …and add cards to the target list, which must be on the same board.
  const access = await loadEditableThread(targetThreadId, user);
  if (!access) return { message: "List not found" };
  const target = access.thread;
  if (!access.canEdit || target.boardId !== note.thread?.boardId) return { message: "Unauthorized" };

  // Move the card to target column/thread
  await d.boardNote.update({
    where: { id: noteId },
    data: { threadId: targetThreadId },
  });

  await logNoteActivity(noteId, session.user.id, NOTE_ACTIVITY.MOVED, { detail: target.title });

  return { message: "moved" };
}
