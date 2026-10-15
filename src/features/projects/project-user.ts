import { db } from "@/lib/db";

/**
 * Srijan permission rule: any *project user* can work on every task in that project — run its
 * timer, change it, and assign it (or its subtasks) to themselves or anyone else; task ownership
 * no longer gates this. A project user is a ProjectMember, the project's owner/creator, or
 * someone in one of its roles (Project Lead, Tech/Creative/Marketing…). Managers pass separately.
 *
 * Plain server module (not a Server Action), so it can't be called from the browser.
 */
export function projectUserWhere(userId: string) {
  return {
    OR: [
      { ownerId: userId },
      { createdByUserId: userId },
      { members: { some: { userId } } },
      { roleAssignments: { some: { userId } } },
    ],
  };
}

export async function isProjectUser(userId: string, projectId: string | null | undefined): Promise<boolean> {
  if (!userId || !projectId) return false;
  const project = await db.project.findFirst({
    where: { id: projectId, ...projectUserWhere(userId) },
    select: { id: true },
  });
  return Boolean(project);
}
