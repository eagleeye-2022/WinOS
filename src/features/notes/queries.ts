import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

export async function getBoards(targetUserId?: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = targetUserId || session.user.id;
  const d = db as any;

  return await d.board.findMany({
    where: {
      OR: [
        { ownerId: userId },
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
    orderBy: { name: "asc" },
  });
}

export async function getThreads(boardId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const d = db as any;

  const whereClause = {
    boardId,
    OR: [
      { authorId: session.user.id },
      { shares: { some: { userId: session.user.id } } },
      { notes: { some: { shares: { some: { userId: session.user.id } } } } }
    ]
  };

  return await d.thread.findMany({
    where: whereClause,
    include: {
      author: { select: { id: true, name: true, email: true, image: true } },
      shares: { select: { userId: true } },
      notes: {
        where: {
          OR: [
            { authorId: session.user.id },
            { shares: { some: { userId: session.user.id } } },
            { thread: { shares: { some: { userId: session.user.id } } } }
          ]
        },
        include: {
          author: { select: { id: true, name: true, email: true, image: true } },
          shares: { select: { userId: true } },
          checklistItems: { orderBy: { position: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      }
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getHistory(targetUserId?: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = targetUserId || session.user.id;
  const d = db as any;

  let whereClause;
  if (userId === session.user.id) {
    whereClause = {
      OR: [
        { authorId: userId },
        { shares: { some: { userId } } },
        { thread: { shares: { some: { userId } } } }
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
      thread: { select: { id: true, title: true, boardId: true } },
      author: { select: { id: true, name: true, email: true, image: true } },
      shares: { select: { userId: true } },
      checklistItems: { orderBy: { position: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
}

export async function getWorkspaceUsers() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const d = db as any;
  return await d.user.findMany({
    select: { id: true, name: true, email: true, image: true, title: true },
    orderBy: { name: "asc" },
  });
}

