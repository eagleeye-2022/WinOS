"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr } from "@/lib/action-utils";
import { logNoteActivity } from "../note-activity";
import { NOTE_ACTIVITY } from "../note-activity-utils";
import { boardNoteAccessInclude, canEditBoardNote } from "./_utils";

export type ToggleBoardNoteItemState = { message?: string };

export async function toggleBoardNoteItem(
  _prevState: ToggleBoardNoteItemState,
  formData: FormData
): Promise<ToggleBoardNoteItemState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const itemId = getStr(formData, "itemId");
  if (!itemId) return { message: "Missing item ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const item = await d.boardNoteChecklistItem.findUnique({
    where: { id: itemId },
    include: {
      note: { include: boardNoteAccessInclude(session.user.id) },
    },
  });
  if (!item) return { message: "Item not found" };

  // Anyone who may edit the card may tick its checklist items
  if (!(await canEditBoardNote(item.note, { id: session.user.id, role: session.user.role }))) {
    return { message: "Unauthorized" };
  }

  await d.boardNoteChecklistItem.update({
    where: { id: itemId },
    data: { checked: !item.checked },
  });

  await logNoteActivity(
    item.noteId,
    session.user.id,
    item.checked ? NOTE_ACTIVITY.CHECKLIST_UNCHECKED : NOTE_ACTIVITY.CHECKLIST_CHECKED,
    { detail: item.text }
  );

  return { message: "toggled" };
}
