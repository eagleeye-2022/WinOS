"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr, validateText } from "@/lib/action-utils";

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
  const deadlineStr = getStr(formData, "deadline");
  const deadline = deadlineStr ? new Date(deadlineStr) : null;
  const shareUserIdsStr = getStr(formData, "shareUserIds") || "";

  if (!boardId) return { message: "Missing board ID" };

  const titleError = validateText("Thread title", title, 120);
  if (titleError) return { errors: { title: titleError } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // 1. Create the thread
  const thread = await d.thread.create({
    data: {
      title,
      boardId,
      authorId: session.user.id,
    },
  });

  // 2. Share the thread if users specified
  const shareUserIds = shareUserIdsStr.split(",").map((s) => s.trim()).filter(Boolean);
  if (shareUserIds.length > 0) {
    await d.threadShare.createMany({
      data: shareUserIds.map((userId) => ({
        threadId: thread.id,
        userId,
      })),
      skipDuplicates: true,
    });
  }

  // 3. Create the initial note if there is content or checklist items
  const hasContent = content.trim().length > 0;
  const items = formData.getAll("item") as string[];
  const validItems = items.map((t) => t.trim()).filter(Boolean);
  const hasChecklist = noteType === "CHECKLIST" && validItems.length > 0;

  if (hasContent || hasChecklist) {
    const note = await d.boardNote.create({
      data: {
        content: noteType === "CHECKLIST" ? "" : content,
        color,
        deadline,
        threadId: thread.id,
        authorId: session.user.id,
      },
    });

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
