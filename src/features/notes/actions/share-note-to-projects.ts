"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";
import { parseIdList } from "../project-notes-utils";
import { logNoteActivity } from "../note-activity";
import { NOTE_ACTIVITY } from "../note-activity-utils";

export type ShareNoteToProjectsState = { message?: string };

/**
 * Project iNotes: sets which projects an iNotes card is shared to (replaces the previous set).
 * Only the card's author may do this; any project can be chosen.
 * Separate from person-to-person sharing (BoardNoteShare), which is untouched.
 */
export async function shareNoteToProjects(
  _prevState: ShareNoteToProjectsState,
  formData: FormData
): Promise<ShareNoteToProjectsState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };
  const userId = session.user.id;

  const noteId = getStr(formData, "noteId");
  if (!noteId) return { message: "Missing note ID" };
  const projectIds = parseIdList(getStr(formData, "projectIds"));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const note = await d.boardNote.findUnique({ where: { id: noteId }, select: { authorId: true } });
  if (!note) return { message: "Note not found" };
  if (note.authorId !== userId) return { message: "Only the card's author can share it to a project" };

  // Only newly added projects need checking — the author can always keep or remove existing ones
  // (e.g. after leaving a project).
  const existing: { projectId: string }[] = await d.boardNoteProjectShare.findMany({
    where: { noteId },
    select: { projectId: true },
  });
  const existingIds = new Set(existing.map((s) => s.projectId));
  const added = projectIds.filter((id) => !existingIds.has(id));

  // Any project may be chosen (the picker lists all projects); just make sure they exist.
  if (added.length > 0) {
    const found = await db.project.findMany({ where: { id: { in: added } }, select: { id: true } });
    if (found.length !== added.length) return { message: "Project not found" };
  }

  // Replace the card's project set: remove projects no longer selected, add new ones.
  await d.boardNoteProjectShare.deleteMany({
    where: { noteId, ...(projectIds.length > 0 ? { projectId: { notIn: projectIds } } : {}) },
  });
  if (projectIds.length > 0) {
    await d.boardNoteProjectShare.createMany({
      data: projectIds.map((projectId) => ({ noteId, projectId, sharedById: userId })),
      skipDuplicates: true,
    });
  }

  // Timeline: one event per project added / removed.
  const removed = Array.from(existingIds).filter((id) => !projectIds.includes(id));
  if (added.length > 0 || removed.length > 0) {
    const named = await db.project.findMany({
      where: { id: { in: [...added, ...removed] } },
      select: { id: true, name: true },
    });
    const nameOf = (id: string) => named.find((p) => p.id === id)?.name || "a project";
    for (const projectId of added) {
      await logNoteActivity(noteId, userId, NOTE_ACTIVITY.SHARED_TO_PROJECT, { detail: nameOf(projectId), projectId });
    }
    for (const projectId of removed) {
      await logNoteActivity(noteId, userId, NOTE_ACTIVITY.REMOVED_FROM_PROJECT, { detail: nameOf(projectId), projectId });
    }
  }

  revalidatePath("/notes");
  revalidatePath("/projects");
  return { message: "shared" };
}
