"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr } from "@/lib/action-utils";
import { logNoteActivity } from "../note-activity";
import { NOTE_ACTIVITY } from "../note-activity-utils";

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
      note: {
        include: {
          author: { select: { id: true, role: true } },
        },
      },
    },
  });
  if (!item) return { message: "Item not found" };

  // Only note author can toggle checklist items
  const hasAccess = item.note.authorId === session.user.id;
  if (!hasAccess) return { message: "Unauthorized" };

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
