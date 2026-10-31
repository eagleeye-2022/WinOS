"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";

export type ShareBoardState = { message?: string };

export async function shareBoard(
  _prevState: ShareBoardState,
  formData: FormData
): Promise<ShareBoardState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const boardId = getStr(formData, "boardId");
  const sharePermissionsStr = getStr(formData, "sharePermissions") || "[]";

  if (!boardId) return { message: "Missing board ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const board = await d.board.findUnique({ where: { id: boardId } });
  if (!board) return { message: "Board not found" };

  if (board.ownerId !== session.user.id && session.user.role !== "MANAGER") {
    return { message: "Unauthorized" };
  }

  let parsed: unknown = [];
  try {
    parsed = JSON.parse(sharePermissionsStr);
  } catch {
    return { message: "Invalid share permissions" };
  }
  if (!Array.isArray(parsed)) return { message: "Invalid share permissions" };

  // One entry per user (last one wins), dropping malformed rows.
  const byUser = new Map<string, boolean>();
  for (const p of parsed) {
    if (p && typeof p.userId === "string" && p.userId) byUser.set(p.userId, p.canEdit === true);
  }
  const sharePermissions = Array.from(byUser, ([userId, canEdit]) => ({ userId, canEdit }));
  const shareUserIds = sharePermissions.map((s) => s.userId);

  const previous: { userId: string }[] = await d.boardShare.findMany({
    where: { boardId },
    select: { userId: true },
  });
  const removedUserIds = previous.map((s) => s.userId).filter((id) => !byUser.has(id));

  // 1. Update BoardShare (board-level collaborators)
  await d.boardShare.deleteMany({ where: { boardId } });
  if (sharePermissions.length > 0) {
    await d.boardShare.createMany({
      data: sharePermissions.map(({ userId, canEdit }) => ({ boardId, userId, canEdit })),
      skipDuplicates: true,
    });
  }

  const threadIds = (
    await d.thread.findMany({ where: { boardId }, select: { id: true } })
  ).map((t: { id: string }) => t.id);

  // 2. Collaborators removed from the board lose its list and card shares too. Shares that
  //    authors gave other people on individual lists or cards are left alone.
  if (removedUserIds.length > 0) {
    await d.threadShare.deleteMany({ where: { threadId: { in: threadIds }, userId: { in: removedUserIds } } });
    await d.boardNoteShare.deleteMany({
      where: { userId: { in: removedUserIds }, note: { thread: { boardId } } },
    });
  }

  // 3. Cascade the current collaborators (with their board-level edit right) to every list and card.
  if (shareUserIds.length > 0 && threadIds.length > 0) {
    await d.threadShare.deleteMany({ where: { threadId: { in: threadIds }, userId: { in: shareUserIds } } });
    await d.threadShare.createMany({
      data: threadIds.flatMap((threadId: string) =>
        sharePermissions.map(({ userId, canEdit }) => ({ threadId, userId, canEdit }))
      ),
      skipDuplicates: true,
    });

    const noteIds = (
      await d.boardNote.findMany({ where: { thread: { boardId } }, select: { id: true } })
    ).map((n: { id: string }) => n.id);
    if (noteIds.length > 0) {
      await d.boardNoteShare.createMany({
        data: noteIds.flatMap((noteId: string) => shareUserIds.map((userId) => ({ noteId, userId }))),
        skipDuplicates: true,
      });
    }
  }

  revalidatePath("/notes");
  revalidatePath("/dsm");
  revalidatePath("/report");
  revalidatePath("/dsm/my");
  revalidatePath("/report/my");
  revalidatePath("/dsm/all");
  revalidatePath("/report/all");
  return { message: "shared" };
}
