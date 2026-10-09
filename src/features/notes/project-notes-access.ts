// Server-side lookups for Project iNotes permissions. Not a "use server" file.
import { db } from "@/lib/db";
import { isPrivilegedRole } from "./project-notes-utils";

/** Re-reads the user's role from the DB (guards against a stale JWT) and checks for MANAGER. */
export async function isPrivilegedUser(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });
  if (!user || user.isActive === false) return false;
  return isPrivilegedRole(user.role);
}

/** The Projects UI addresses projects by id or by code; returns the real id, or null. */
export async function resolveProjectId(idOrCode: string): Promise<string | null> {
  if (!idOrCode) return null;
  const project = await db.project.findFirst({
    where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
    select: { id: true },
  });
  return project?.id ?? null;
}

/** Same membership notion the project list uses: member, role assignee, owner or creator. */
export function projectMembershipWhere(userId: string) {
  return {
    OR: [
      { members: { some: { userId } } },
      { roleAssignments: { some: { userId } } },
      { ownerId: userId },
      { createdByUserId: userId },
    ],
  };
}

export async function isProjectMember(userId: string, projectId: string): Promise<boolean> {
  const count = await db.project.count({
    where: { id: projectId, ...projectMembershipWhere(userId) },
  });
  return count > 0;
}

export type ShareableProject = { id: string; code: string | null; name: string };

/** Projects a user may share cards to: every project, for everyone (signed in). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getShareableProjectsFor(_userId: string): Promise<ShareableProject[]> {
  return db.project.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** True when the user is a manager and the card is shared to at least one project. */
export async function isManagerOnProjectSharedNote(userId: string, noteId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shared = await (db as any).boardNoteProjectShare.count({ where: { noteId } });
  if (!shared) return false;
  return isPrivilegedUser(userId);
}
