"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr } from "@/lib/action-utils";

export type UpdateBoardNoteState = { message?: string };

export async function updateBoardNote(
  _prevState: UpdateBoardNoteState,
  formData: FormData
): Promise<UpdateBoardNoteState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const id = getStr(formData, "id");
  const title = getStr(formData, "title") ?? undefined;
  const content = getStr(formData, "content") || "";
  const color = getStr(formData, "color") || "#ffffff";
  const deadlineStr = getStr(formData, "deadline");
  const deadline = deadlineStr ? new Date(deadlineStr) : null;

  if (!id) return { message: "Missing note ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Verify ownership / authorization: the author, a user granted edit access
  // on the note's thread via ThreadShare.canEdit, or a manager editing a note
  // on a DSM workspace board (matches the pre-existing blanket manager access
  // to team members' DSM notes) may update it.
  const note = await d.boardNote.findUnique({
    where: { id },
    include: {
      thread: {
        include: {
          shares: { where: { userId: session.user.id } },
          board: { select: { type: true } },
        },
      },
    },
  });
  if (!note) return { message: "Note not found" };

  const isAuthor = note.authorId === session.user.id;
  const hasEditAccess = note.thread?.shares?.[0]?.canEdit === true;
  const isManagerOnDsmBoard = session.user.role === "MANAGER" && note.thread?.board?.type === "DSM";
  if (!isAuthor && !hasEditAccess && !isManagerOnDsmBoard) {
    return { message: "Unauthorized" };
  }

  // Update note body
  await d.boardNote.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title: title || null } : {}),
      content,
      color,
      deadline,
    },
  });

  // Sync checklist items
  await d.boardNoteChecklistItem.deleteMany({ where: { noteId: id } });
  const items = formData.getAll("item") as string[];
  const itemsChecked = formData.getAll("itemChecked") as string[];
  const validItems = items
    .map((text, i) => ({
      text: text.trim(),
      checked: itemsChecked[i] === "true",
      position: i,
    }))
    .filter((item) => Boolean(item.text));

  if (validItems.length > 0) {
    await d.boardNoteChecklistItem.createMany({
      data: validItems.map((item) => ({
        text: item.text,
        checked: item.checked,
        position: item.position,
        noteId: id,
      })),
    });
  }

  console.log("[updateBoardNote] Note updated successfully:", { id, content });

  return { message: "updated" };
}
