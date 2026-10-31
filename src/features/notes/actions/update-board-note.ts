"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr } from "@/lib/action-utils";
import { logNoteActivity } from "../note-activity";
import { NOTE_ACTIVITY } from "../note-activity-utils";
import { boardNoteAccessInclude, canEditBoardNote, parseDeadline } from "./_utils";

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
  const deadline = parseDeadline(getStr(formData, "deadline"));

  if (!id) return { message: "Missing note ID" };
  if (deadline === undefined) return { message: "Invalid deadline" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Verify authorization (author, list/board owner, collaborators with edit rights, managers
  // on DSM or project-shared cards — see canEditBoardNote).
  const note = await d.boardNote.findUnique({
    where: { id },
    include: boardNoteAccessInclude(session.user.id),
  });
  if (!note) return { message: "Note not found" };

  if (!(await canEditBoardNote(note, { id: session.user.id, role: session.user.role }))) {
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

  await logNoteActivity(id, session.user.id, NOTE_ACTIVITY.UPDATED);

  return { message: "updated" };
}
