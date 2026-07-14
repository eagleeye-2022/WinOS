"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr } from "@/lib/action-utils";

export type CreateBoardNoteState = { message?: string };

export async function createBoardNote(
  _prevState: CreateBoardNoteState,
  formData: FormData
): Promise<CreateBoardNoteState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const threadId = getStr(formData, "threadId");
  const content = getStr(formData, "content") || "";
  const color = getStr(formData, "color") || "#ffffff";
  const deadlineStr = getStr(formData, "deadline");
  const deadline = deadlineStr ? new Date(deadlineStr) : null;

  if (!threadId) return { message: "Missing thread ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Verify thread exists
  const thread = await d.thread.findUnique({ where: { id: threadId } });
  if (!thread) return { message: "Thread not found" };

  // Create note
  const note = await d.boardNote.create({
    data: {
      content,
      color,
      deadline,
      threadId,
      authorId: session.user.id,
    },
  });

  // Handle checklist items if any
  const items = formData.getAll("item") as string[];
  const validItems = items.map((t) => t.trim()).filter(Boolean);
  if (validItems.length > 0) {
    await d.boardNoteChecklistItem.createMany({
      data: validItems.map((text, i) => ({
        text,
        position: i,
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

  console.log("[createBoardNote] Note created successfully:", { id: note.id, content: note.content });

  return { message: "created" };
}
