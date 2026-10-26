// Server-side writer for the iNotes card timeline. Not a "use server" file.
import { db } from "@/lib/db";
import { NOTE_ACTIVITY, type NoteActivityAction } from "./note-activity-utils";
import { sameNoteSnapshot, type NoteSnapshot } from "./note-versions";

/**
 * Records one timeline event. Best-effort: a failure here is logged and swallowed so it can
 * never break or roll back the card change that triggered it. A create or edit also saves a copy
 * of the card as a new version (see saveNoteVersion).
 */
export async function logNoteActivity(
  noteId: string,
  userId: string,
  action: NoteActivityAction,
  extra?: { detail?: string | null; projectId?: string | null }
): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, role: true },
    });
    const userName = user?.name || user?.email?.split("@")[0] || "Unknown";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activity = await (db as any).boardNoteActivity.create({
      data: {
        noteId,
        userId,
        userName,
        userRole: user?.role ?? null,
        action,
        detail: extra?.detail ? String(extra.detail).slice(0, 200) : null,
        projectId: extra?.projectId ?? null,
      },
    });
    if (action === NOTE_ACTIVITY.CREATED || action === NOTE_ACTIVITY.UPDATED) {
      await saveNoteVersion(noteId, { userId, userName, activityId: activity.id });
    }
  } catch (err) {
    console.error("[logNoteActivity] failed to record", action, "for note", noteId, err);
  }
}

/**
 * Saves the card as it is now as the next version — skipped when nothing changed since the last
 * version (a save with no edits). Best-effort, like the timeline event itself.
 */
async function saveNoteVersion(
  noteId: string,
  by: { userId: string; userName: string; activityId: string }
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = db as any;
    const note = await d.boardNote.findUnique({
      where: { id: noteId },
      select: {
        title: true,
        content: true,
        color: true,
        deadline: true,
        checklistItems: { select: { text: true, checked: true }, orderBy: { position: "asc" } },
      },
    });
    if (!note) return;
    const snapshot: NoteSnapshot = {
      title: note.title ?? null,
      content: note.content ?? "",
      color: note.color ?? null,
      deadline: note.deadline ? new Date(note.deadline).toISOString() : null,
      checklist: (note.checklistItems || []).map((i: { text: string; checked: boolean }) => ({
        text: i.text,
        checked: i.checked,
      })),
    };
    const last = await d.boardNoteVersion.findFirst({ where: { noteId }, orderBy: { version: "desc" } });
    if (last && sameNoteSnapshot(last, snapshot)) return;
    await d.boardNoteVersion.create({
      data: {
        noteId,
        version: (last?.version ?? 0) + 1,
        ...snapshot,
        deadline: snapshot.deadline ? new Date(snapshot.deadline) : null,
        activityId: by.activityId,
        userId: by.userId,
        userName: by.userName,
      },
    });
  } catch (err) {
    console.error("[saveNoteVersion] failed for note", noteId, err);
  }
}
