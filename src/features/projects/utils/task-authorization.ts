/**
 * Shared "is this user authorized to act on this task" rule, extracted from the logic that used
 * to be duplicated across `project-actions.ts` (`updateTaskAction`, `deleteTaskAction`) and
 * `single-task-workspace-view.tsx`. A task is actionable by any of its owners (checked against
 * `ProjectTaskOwner` first, with legacy `ownerId`/name-string fallbacks for rows that predate it),
 * or by the owner of the project it belongs to. Pure function, no server-only imports, so it's
 * safe to import from both server actions and client components.
 */

export interface TaskAuthInput {
  ownerId?: string | null;
  /** Resolved user ids of every owner, from the `ProjectTaskOwner` join table. */
  ownerIds?: string[] | null;
  /** Legacy display-name/email fallback, only consulted when `ownerIds` is empty. */
  ownerNames?: string[] | null;
  projectOwnerId?: string | null;
}

export interface ActingUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

export function canUserActOnTask(task: TaskAuthInput, user: ActingUser | null | undefined): boolean {
  if (!user?.id) return false;

  if (task.projectOwnerId && task.projectOwnerId === user.id) return true;
  if (task.ownerIds && task.ownerIds.includes(user.id)) return true;
  if (task.ownerId && task.ownerId === user.id) return true;

  const names = (task.ownerNames || [])
    .map((n) => n.trim().toLowerCase())
    .filter((n) => n && n !== "unassigned");
  if (names.length === 0) return false;

  const uId = user.id.toLowerCase();
  const uName = (user.name || "").trim().toLowerCase();
  const uEmail = (user.email || "").trim().toLowerCase();

  return names.some(
    (o) =>
      o === uId ||
      o === uName ||
      o === uEmail ||
      (uName.length > 2 && o.includes(uName)) ||
      (o.length > 2 && uName.includes(o))
  );
}
