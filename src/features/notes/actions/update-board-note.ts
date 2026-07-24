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

  // Verify ownership / authorization
  const note = await d.boardNote.findUnique({
    where: { id },
  });
  if (!note) return { message: "Note not found" };

  if (note.authorId !== session.user.id) {
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
  const validItems = items.map((t) => t.trim()).filter(Boolean);
  if (validItems.length > 0) {
    await d.boardNoteChecklistItem.createMany({
      data: validItems.map((text, i) => ({
        text,
        position: i,
        noteId: id,
      })),
    });
  }

  console.log("[updateBoardNote] Note updated successfully:", { id, content });

  return { message: "updated" };
}
