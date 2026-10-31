import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getShareableProjectsFor, isPrivilegedUser, type ShareableProject } from "./project-notes-access";

export type ChecklistItemData = {
  id: string;
  text: string;
  checked: boolean;
  position: number;
};

export type NoteWithDetails = {
  id: string;
  title: string;
  content: string;
  type: "TEXT" | "CHECKLIST";
  color: string | null;
  isPinned: boolean;
  reminderAt: Date | null;
  notebookId: string | null;
  notebook: { id: string; name: string; color: string | null } | null;
  authorId: string;
  author: { name: string | null; email: string };
  tags: { tag: { id: string; name: string } }[];
  checklistItems: ChecklistItemData[];
  createdAt: Date;
  updatedAt: Date;
};

export type NotebookData = {
  id: string;
  name: string;
  color: string | null;
};

export async function getNotes(): Promise<NoteWithDetails[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const isManager = session.user.role === "MANAGER";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notes = await (db as any).note.findMany({
    where: isManager ? undefined : { authorId: session.user.id },
    include: {
      author: { select: { name: true, email: true } },
      notebook: { select: { id: true, name: true, color: true } },
      tags: { include: { tag: { select: { id: true, name: true } } } },
      checklistItems: { orderBy: { position: "asc" } },
    },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  });

  return notes as NoteWithDetails[];
}

export async function getNotebooks(): Promise<NotebookData[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notebooks = await (db as any).notebook.findMany({
    where: { ownerId: session.user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });

  return notebooks as NotebookData[];
}

/**
 * The user whose notes a query should read: the signed-in user, or — for managers only — the
 * `targetUserId` they asked for. Null when a non-manager asks for someone else.
 */
async function resolveTargetUserId(sessionUserId: string, targetUserId?: string): Promise<string | null> {
  if (!targetUserId || targetUserId === sessionUserId) return sessionUserId;
  return (await isPrivilegedUser(sessionUserId)) ? targetUserId : null;
}

export async function getBoards(targetUserId?: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = await resolveTargetUserId(session.user.id, targetUserId);
  if (!userId) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  return await d.board.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { shares: { some: { userId } } },
        {
          threads: {
            some: {
              OR: [
                { authorId: userId },
                { shares: { some: { userId } } },
                { notes: { some: { shares: { some: { userId } } } } }
              ]
            }
          }
        }
      ]
    },
    include: {
      shares: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true, title: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getThreads(boardId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const userId = session.user.id;

  // The board's owner and its collaborators (BoardShare) see every list and card on it — including
  // lists made after the board was shared and cards other collaborators add. Managers see whole
  // DSM boards (they may edit DSM cards — see canEditBoardNote).
  const board = await d.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true, type: true, shares: { where: { userId }, select: { userId: true } } },
  });
  if (!board) return [];
  const seesWholeBoard =
    board.ownerId === userId ||
    board.shares.length > 0 ||
    (session.user.role === "MANAGER" && board.type === "DSM");

  const whereClause = seesWholeBoard
    ? { boardId }
    : {
        boardId,
        OR: [
          { authorId: userId },
          { shares: { some: { userId } } },
          { notes: { some: { shares: { some: { userId } } } } }
        ]
      };

  return await d.thread.findMany({
    where: whereClause,
    include: {
      author: { select: { id: true, name: true, email: true, image: true } },
      shares: { select: { userId: true, canEdit: true } },
      notes: {
        where: seesWholeBoard
          ? undefined
          : {
              OR: [
                { authorId: userId },
                { shares: { some: { userId } } },
                { thread: { shares: { some: { userId } } } },
                // Cards collaborators added to a list the user owns
                { thread: { authorId: userId } }
              ]
            },
        include: {
          author: { select: { id: true, name: true, email: true, image: true } },
          shares: { select: { userId: true } },
          checklistItems: { orderBy: { position: "asc" } },
          projectShares: {
            select: { projectId: true, project: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      }
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Projects the signed-in user may share iNotes cards to (Project iNotes). */
export async function getShareableProjects(): Promise<ShareableProject[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  return getShareableProjectsFor(session.user.id);
}

export async function getHistory(targetUserId?: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = targetUserId || session.user.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  let whereClause;
  if (userId === session.user.id) {
    whereClause = {
      OR: [
        { authorId: userId },
        { shares: { some: { userId } } },
        { thread: { shares: { some: { userId } } } },
        // Cards collaborators added or edited on the user's lists and boards
        { thread: { authorId: userId } },
        { thread: { board: { ownerId: userId } } },
        { thread: { board: { shares: { some: { userId } } } } }
      ]
    };
  } else {
    whereClause = {
      authorId: userId,
      OR: [
        { shares: { some: { userId: session.user.id } } },
        { thread: { shares: { some: { userId: session.user.id } } } }
      ]
    };
  }

  return await d.boardNote.findMany({
    where: whereClause,
    include: {
      thread: { select: { id: true, title: true, boardId: true, board: { select: { name: true } } } },
      author: { select: { id: true, name: true, email: true, image: true } },
      shares: { select: { userId: true } },
      checklistItems: { orderBy: { position: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
}

export async function getSharedWithMeNotes(targetUserId?: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = await resolveTargetUserId(session.user.id, targetUserId);
  if (!userId) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  return await d.boardNote.findMany({
    where: {
      authorId: { not: userId },
      thread: { board: { type: { not: "DSM" } } },
      OR: [
        { shares: { some: { userId } } },
        { thread: { shares: { some: { userId } } } }
      ]
    },
    include: {
      thread: {
        select: {
          id: true,
          title: true,
          boardId: true,
          board: { select: { id: true, name: true, type: true } }
        }
      },
      author: { select: { id: true, name: true, email: true, image: true, role: true } },
      shares: { select: { userId: true } },
      checklistItems: { orderBy: { position: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getSharedByMeNotes(targetUserId?: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = await resolveTargetUserId(session.user.id, targetUserId);
  if (!userId) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  return await d.boardNote.findMany({
    where: {
      authorId: userId,
      thread: { board: { type: { not: "DSM" } } },
      OR: [
        { shares: { some: {} } },
        { thread: { shares: { some: {} } } }
      ]
    },
    include: {
      thread: {
        select: {
          id: true,
          title: true,
          boardId: true,
          board: { select: { id: true, name: true, type: true } },
          shares: {
            include: {
              user: { select: { id: true, name: true, email: true } }
            }
          }
        }
      },
      author: { select: { id: true, name: true, email: true, image: true, role: true } },
      shares: {
        include: {
          user: { select: { id: true, name: true, email: true } }
        }
      },
      checklistItems: { orderBy: { position: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getWorkspaceUsers() {
  const session = await auth();
  if (!session?.user?.id) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  return await d.user.findMany({
    select: { id: true, name: true, email: true, image: true, title: true },
    orderBy: { name: "asc" },
  });
}

