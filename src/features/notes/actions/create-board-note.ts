"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr } from "@/lib/action-utils";
import { logNoteActivity } from "../note-activity";
import { NOTE_ACTIVITY } from "../note-activity-utils";
import { loadEditableThread, parseDeadline } from "./_utils";

export type CreateBoardNoteState = { message?: string };

export async function createBoardNote(
  _prevState: CreateBoardNoteState,
  formData: FormData
): Promise<CreateBoardNoteState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const threadId = getStr(formData, "threadId");
  const title = getStr(formData, "title") || null;
  const content = getStr(formData, "content") || "";
  const color = getStr(formData, "color") || "#ffffff";
  const deadline = parseDeadline(getStr(formData, "deadline"));

  if (!threadId) return { message: "Missing thread ID" };
  if (deadline === undefined) return { message: "Invalid deadline" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Verify the thread exists and the user may add cards to it
  const access = await loadEditableThread(threadId, { id: session.user.id, role: session.user.role });
  if (!access) return { message: "Thread not found" };
  if (!access.canEdit) return { message: "Unauthorized" };

  // Create note
  const note = await d.boardNote.create({
    data: {
      title,
      content,
      color,
      deadline,
      threadId,
      authorId: session.user.id,
    },
  });

  // Handle checklist items if any
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
        noteId: note.id,
      })),
    });
  }

  // Inherit thread shares
  const threadShares = await d.threadShare.findMany({
    where: { threadId },
    select: { userId: true },
  });
  if (threadShares.length > 0) {
    await d.boardNoteShare.createMany({
      data: threadShares.map((ts: { userId: string }) => ({
        noteId: note.id,
        userId: ts.userId,
      })),
      skipDuplicates: true,
    });
  }

  await logNoteActivity(note.id, session.user.id, NOTE_ACTIVITY.CREATED);

  return { message: "created" };
}
