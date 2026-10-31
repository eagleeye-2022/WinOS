"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr, validateText } from "@/lib/action-utils";
import { logNoteActivity } from "../note-activity";
import { NOTE_ACTIVITY } from "../note-activity-utils";
import { parseDeadline } from "./_utils";

export type CreateThreadState = { errors?: { title?: string[] }; message?: string };

export async function createThread(
  _prevState: CreateThreadState,
  formData: FormData
): Promise<CreateThreadState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const boardId = getStr(formData, "boardId");
  const title = getStr(formData, "title");
  const content = getStr(formData, "content") || "";
  const noteType = getStr(formData, "noteType") || "TEXT";
  const color = getStr(formData, "color") || "#ffffff";
  const deadline = parseDeadline(getStr(formData, "deadline"));
  const shareUserIdsStr = getStr(formData, "shareUserIds") || "";

  if (!boardId) return { message: "Missing board ID" };
  if (deadline === undefined) return { message: "Invalid deadline" };

  const titleError = validateText("Thread title", title, 120);
  if (titleError) return { errors: { title: titleError } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Only the board's owner, a manager, or a board collaborator with edit rights may add lists.
  const board = await d.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true, shares: { where: { userId: session.user.id }, select: { canEdit: true } } },
  });
  if (!board) return { message: "Board not found" };
  const canAddList =
    board.ownerId === session.user.id ||
    session.user.role === "MANAGER" ||
    board.shares?.[0]?.canEdit === true;
  if (!canAddList) return { message: "Unauthorized" };

  // 1. Create the thread
  const thread = await d.thread.create({
    data: {
      title,
      boardId,
      authorId: session.user.id,
    },
  });

  // 2. Share the thread with the board's collaborators (keeping their board-level edit right)
  //    and with any users picked in the form (view-only, unless they're board editors).
  const boardShares: { userId: string; canEdit: boolean }[] = await d.boardShare.findMany({
    where: { boardId },
    select: { userId: true, canEdit: true },
  });
  const permissions = new Map<string, boolean>();
  for (const s of boardShares) permissions.set(s.userId, s.canEdit === true);
  for (const userId of shareUserIdsStr.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (!permissions.has(userId)) permissions.set(userId, false);
  }
  permissions.delete(session.user.id);
  const shareUserIds = Array.from(permissions.keys());
  if (shareUserIds.length > 0) {
    await d.threadShare.createMany({
      data: Array.from(permissions, ([userId, canEdit]) => ({ threadId: thread.id, userId, canEdit })),
      skipDuplicates: true,
    });
  }

  // 3. Create the initial note if there is content or checklist items
  const noteTitle = getStr(formData, "noteTitle") || null;
  const hasContent = content.trim().length > 0;
  const items = formData.getAll("item") as string[];
  const validItems = items.map((t) => t.trim()).filter(Boolean);
  const hasChecklist = noteType === "CHECKLIST" && validItems.length > 0;

  if (hasContent || hasChecklist || noteTitle) {
    const note = await d.boardNote.create({
      data: {
        title: noteTitle,
        content: noteType === "CHECKLIST" ? "" : content,
        color,
        deadline,
        threadId: thread.id,
        authorId: session.user.id,
      },
    });

    await logNoteActivity(note.id, session.user.id, NOTE_ACTIVITY.CREATED);

    if (noteType === "CHECKLIST" && validItems.length > 0) {
      await d.boardNoteChecklistItem.createMany({
        data: validItems.map((text, i) => ({
          text,
          position: i,
          noteId: note.id,
        })),
      });
    }

    // Automatically share note with same shared users
    if (shareUserIds.length > 0) {
      await d.boardNoteShare.createMany({
        data: shareUserIds.map((userId) => ({
          noteId: note.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }
  }

  return { message: "created" };
}
