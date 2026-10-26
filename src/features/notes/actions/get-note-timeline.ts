"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPrivilegedUser, projectMembershipWhere } from "../project-notes-access";
import { buildTimeline, type TimelineEvent } from "../note-activity-utils";
import { toNoteSnapshot, type NoteSnapshot } from "../note-versions";

export type NoteTimelineResult = { success: true; events: TimelineEvent[] } | { success: false; error: string };

export type NoteVersionResult =
  | {
      success: true;
      version: number;
      latestVersion: number;
      userName: string;
      createdAt: string;
      snapshot: NoteSnapshot;
      /** The version before it (null for the first) — for "what changed". */
      previous: NoteSnapshot | null;
    }
  | { success: false; error: string };

/** One saved version of a card plus the one before it — for anyone who can see the card. */
export async function getNoteVersion(noteId: string, version: number): Promise<NoteVersionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    if (!noteId || !Number.isInteger(version)) return { success: false, error: "Missing version" };
    const access = await loadViewableNote(noteId, session.user.id);
    if ("error" in access) return { success: false, error: access.error };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = db as any;
    const [row, previous, latest] = await Promise.all([
      d.boardNoteVersion.findUnique({ where: { noteId_version: { noteId, version } } }),
      d.boardNoteVersion.findFirst({ where: { noteId, version: { lt: version } }, orderBy: { version: "desc" } }),
      d.boardNoteVersion.findFirst({ where: { noteId }, orderBy: { version: "desc" }, select: { version: true } }),
    ]);
    if (!row) return { success: false, error: "That version wasn't found" };
    return {
      success: true,
      version: row.version,
      latestVersion: latest?.version ?? row.version,
      userName: row.userName,
      createdAt: new Date(row.createdAt).toISOString(),
      snapshot: toNoteSnapshot(row),
      previous: previous ? toNoteSnapshot(previous) : null,
    };
  } catch (err) {
    console.error("[getNoteVersion] failed for note", noteId, version, err);
    return { success: false, error: "Couldn't load that version. Please try again." };
  }
}

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

  const access = await loadViewableNote(noteId, userId);
  if ("error" in access) return { success: false, error: access.error };
  const { note } = access;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const rows = await d.boardNoteActivity.findMany({
    where: { noteId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, action: true, detail: true, userName: true, userRole: true, createdAt: true },
  });

  // Version numbers for the create / edit events that saved a copy of the card. Optional: the
  // timeline still loads without them (e.g. before the versions table exists).
  let versionByActivity = new Map<string, number>();
  try {
    const versions: { activityId: string | null; version: number }[] = await d.boardNoteVersion.findMany({
      where: { noteId, activityId: { in: rows.map((r: { id: string }) => r.id) } },
      select: { activityId: true, version: true },
    });
    versionByActivity = new Map(
      versions.filter((v) => v.activityId).map((v) => [v.activityId as string, v.version])
    );
  } catch (err) {
    console.error("[getNoteTimeline] versions unavailable for note", noteId, err);
  }

  const events = buildTimeline(rows, {
    id: note.id,
    createdAt: note.createdAt,
    authorName: note.author?.name || note.author?.email?.split("@")[0] || "Unknown",
    authorRole: note.author?.role ?? null,
  }).map((e) => (versionByActivity.has(e.id) ? { ...e, version: versionByActivity.get(e.id) } : e));

  return { success: true, events };
}

/** The card, if this user can see it (author, shared with them, board owner/share, manager, or project member). */
async function loadViewableNote(
  noteId: string,
  userId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ note: any } | { error: string }> {
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
  if (!note) return { error: "Note not found" };

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

  if (!canView) return { error: "You don't have access to this card" };
  return { note };
}
