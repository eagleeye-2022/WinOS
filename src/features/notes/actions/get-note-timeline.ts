"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPrivilegedUser, projectMembershipWhere } from "../project-notes-access";
import { buildTimeline, type TimelineEvent } from "../note-activity-utils";

export type NoteTimelineResult = { success: true; events: TimelineEvent[] } | { success: false; error: string };

/** Who created / updated / shared an iNotes card and when — for anyone who can see the card. */
export async function getNoteTimeline(noteId: string): Promise<NoteTimelineResult> {
  try {
    return await loadNoteTimeline(noteId);
  } catch (err) {
    // Never surface a 500 to the card dialog; the timeline is informational only.
    console.error("[getNoteTimeline] failed for note", noteId, err);
    return { success: false, error: "Couldn't load the timeline. Please try again." };
  }
}

async function loadNoteTimeline(noteId: string): Promise<NoteTimelineResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  const userId = session.user.id;
  if (!noteId) return { success: false, error: "Missing note ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const note = await d.boardNote.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      authorId: true,
      createdAt: true,
      author: { select: { name: true, email: true, role: true } },
      shares: { where: { userId }, select: { userId: true } },
      projectShares: { select: { projectId: true } },
      thread: {
        select: {
          shares: { where: { userId }, select: { userId: true } },
          board: { select: { ownerId: true, shares: { where: { userId }, select: { userId: true } } } },
        },
      },
    },
  });
  if (!note) return { success: false, error: "Note not found" };

  let canView =
    note.authorId === userId ||
    note.shares.length > 0 ||
    (note.thread?.shares?.length ?? 0) > 0 ||
    note.thread?.board?.ownerId === userId ||
    (note.thread?.board?.shares?.length ?? 0) > 0;

  if (!canView) canView = await isPrivilegedUser(userId);

  if (!canView && note.projectShares.length > 0) {
    const memberOf = await db.project.count({
      where: {
        id: { in: note.projectShares.map((s: { projectId: string }) => s.projectId) },
        ...projectMembershipWhere(userId),
      },
    });
    canView = memberOf > 0;
  }

  if (!canView) return { success: false, error: "You don't have access to this card" };

  const rows = await d.boardNoteActivity.findMany({
    where: { noteId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, action: true, detail: true, userName: true, userRole: true, createdAt: true },
  });

  return {
    success: true,
    events: buildTimeline(rows, {
      id: note.id,
      createdAt: note.createdAt,
      authorName: note.author?.name || note.author?.email?.split("@")[0] || "Unknown",
      authorRole: note.author?.role ?? null,
    }),
  };
}
