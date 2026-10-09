// Server-side writer for the iNotes card timeline. Not a "use server" file.
import { db } from "@/lib/db";
import type { NoteActivityAction } from "./note-activity-utils";

/**
 * Records one timeline event. Best-effort: a failure here is logged and swallowed so it can
 * never break or roll back the card change that triggered it.
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).boardNoteActivity.create({
      data: {
        noteId,
        userId,
        userName: user?.name || user?.email?.split("@")[0] || "Unknown",
        userRole: user?.role ?? null,
        action,
        detail: extra?.detail ? String(extra.detail).slice(0, 200) : null,
        projectId: extra?.projectId ?? null,
      },
    });
  } catch (err) {
    console.error("[logNoteActivity] failed to record", action, "for note", noteId, err);
  }
}
