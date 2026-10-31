// Server-side helpers shared across note actions. Not a "use server" file.
import { db } from "@/lib/db";
import { isManagerOnProjectSharedNote } from "../project-notes-access";

/** Prisma `include` that loads what `canEditBoardNote` needs about a card's list and board. */
export function boardNoteAccessInclude(userId: string) {
  return {
    thread: {
      include: {
        shares: { where: { userId } },
        board: {
          select: {
            type: true,
            ownerId: true,
            shares: { where: { userId }, select: { canEdit: true } },
          },
        },
      },
    },
  };
}

/**
 * Who may edit an iNotes card (content, checklist, ticks): its author, the list's author, the
 * board's owner, a list or board collaborator with edit rights, a manager on a DSM board, or any
 * manager once the card is shared to a project. `note` must be loaded with `boardNoteAccessInclude`.
 */
export async function canEditBoardNote(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  note: any,
  user: { id: string; role?: string | null }
): Promise<boolean> {
  const thread = note.thread;
  if (
    note.authorId === user.id ||
    thread?.authorId === user.id ||
    thread?.board?.ownerId === user.id ||
    thread?.shares?.[0]?.canEdit === true ||
    thread?.board?.shares?.[0]?.canEdit === true ||
    (user.role === "MANAGER" && thread?.board?.type === "DSM")
  ) {
    return true;
  }
  // Project iNotes: any manager may edit a card that has been shared to a project.
  return isManagerOnProjectSharedNote(user.id, note.id);
}

/**
 * Replaces all NoteTag records for a note with entries derived from a
 * comma-separated tag string. Tags are upserted per owner so re-using an
 * existing tag name never creates a duplicate.
 */
export async function syncTags(
  noteId: string,
  authorId: string,
  tagNamesRaw: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  await d.noteTag.deleteMany({ where: { noteId } });

  const names = tagNamesRaw
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);

  for (const name of names) {
    const tag = await d.tag.upsert({
      where: { name_ownerId: { name, ownerId: authorId } },
      create: { name, ownerId: authorId },
      update: {},
    });
    await d.noteTag.createMany({
      data: [{ noteId, tagId: tag.id }],
      skipDuplicates: true,
    });
  }
}

/**
 * Parses a posted card deadline. "" → null (no deadline); an unparseable value → undefined so
 * the caller can reject it instead of handing Prisma an Invalid Date.
 */
export function parseDeadline(raw: string): Date | null | undefined {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Who may delete a card: its author, the list's author, or the board's owner (so owners can clear
 * cards collaborators added). `note` needs `authorId`, `thread.authorId` and `thread.board.ownerId`.
 */
export function canDeleteBoardNote(
  note: { authorId: string; thread?: { authorId: string; board?: { ownerId: string } | null } | null },
  userId: string
): boolean {
  return note.authorId === userId || note.thread?.authorId === userId || note.thread?.board?.ownerId === userId;
}

/**
 * Who may rename, share or delete a list: its author, the board's owner, or a manager (the
 * workspace's list-header buttons use the same rule). `thread` needs `authorId` and `board.ownerId`.
 */
export function canManageThread(
  thread: { authorId: string; board?: { ownerId: string } | null },
  user: { id: string; role?: string | null }
): boolean {
  return thread.authorId === user.id || thread.board?.ownerId === user.id || user.role === "MANAGER";
}

/**
 * Whether a user may add cards to a list (iNotes thread). Mirrors the workspace's
 * `canEditThread`: the list's author, the board's owner, a manager, a board collaborator with
 * edit rights, or a list collaborator with edit rights. Returns the thread (or null if missing).
 */
export async function loadEditableThread(
  threadId: string,
  user: { id: string; role?: string | null }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ thread: any; canEdit: boolean } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const thread = await d.thread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      title: true,
      authorId: true,
      boardId: true,
      shares: { where: { userId: user.id }, select: { canEdit: true } },
      board: { select: { ownerId: true, shares: { where: { userId: user.id }, select: { canEdit: true } } } },
    },
  });
  if (!thread) return null;
  const canEdit =
    thread.authorId === user.id ||
    thread.board?.ownerId === user.id ||
    user.role === "MANAGER" ||
    thread.board?.shares?.[0]?.canEdit === true ||
    thread.shares?.[0]?.canEdit === true;
  return { thread, canEdit };
}

/**
 * Replaces all ChecklistItem records for a note with a new ordered list.
 * Blank strings are silently filtered out.
 */
export async function syncChecklistItems(
  noteId: string,
  items: string[]
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  await d.checklistItem.deleteMany({ where: { noteId } });

  const valid = items.map((t) => t.trim()).filter(Boolean);
  if (valid.length === 0) return;

  await d.checklistItem.createMany({
    data: valid.map((text, i) => ({ text, position: i, noteId })),
  });
}
