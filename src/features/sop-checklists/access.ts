/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/db";
import { canUserActOnTask } from "@/features/projects/utils/task-authorization";
import { isProjectUser } from "@/features/projects/project-user";

/**
 * Who may do what with SOP checklists. Plain server module (not a Server Action), so it can't be
 * called from the browser.
 *
 * - Managers (same role check as project templates — see `requireManager` in
 *   projects/actions/template-actions.ts) manage SOP templates and attach/detach them on tasks.
 * - Anyone who may work on the task (`updateTaskAction`'s rule: task owners, the project owner,
 *   project users) ticks its checklist items.
 */

const d = db as any;

export interface ActingUser {
  id: string;
  name: string;
  email: string | null;
  isManager: boolean;
}

function isManagerRole(role: unknown, profileRole: unknown): boolean {
  const roleStr = String(role || "").toUpperCase();
  return (
    roleStr === "ADMIN" ||
    roleStr === "SUPER_ADMIN" ||
    roleStr === "PROJECT_MANAGER" ||
    roleStr === "MANAGER" ||
    profileRole === "ADMIN"
  );
}

/** Re-reads the session user from the DB (guards against a stale JWT for a deleted user). */
export async function loadActingUser(userId: string): Promise<ActingUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, profileRole: true, isActive: true },
  });
  if (!user || user.isActive === false) return null;
  return {
    id: user.id,
    name: user.name || user.email || "User",
    email: user.email,
    isManager: isManagerRole(user.role, user.profileRole),
  };
}

export interface TaskAccess {
  task: { id: string; code: string; status: string; projectId: string | null };
  canManage: boolean;
  canCheck: boolean;
}

/** Resolves a task by id or code and works out the user's checklist rights on it. */
export async function getTaskAccess(taskIdOrCode: string, user: ActingUser): Promise<TaskAccess | null> {
  const task = await d.projectTask.findFirst({
    where: { OR: [{ id: taskIdOrCode }, { code: taskIdOrCode }] },
    select: {
      id: true,
      code: true,
      status: true,
      projectId: true,
      ownerId: true,
      owner: true,
      project: { select: { ownerId: true } },
      owners: { select: { userId: true, user: { select: { name: true, email: true } } } },
    },
  });
  if (!task) return null;

  const base = { id: task.id, code: task.code, status: task.status, projectId: task.projectId };
  if (user.isManager) return { task: base, canManage: true, canCheck: true };

  const ownerIds = task.owners.map((o: { userId: string }) => o.userId);
  const ownerNames =
    task.owners.length > 0
      ? task.owners.map((o: { user: { name: string | null; email: string } }) => o.user.name || o.user.email)
      : task.owner && task.owner !== "Unassigned"
      ? [task.owner]
      : [];

  const canCheck =
    canUserActOnTask(
      { ownerId: task.ownerId, ownerIds, ownerNames, projectOwnerId: task.project?.ownerId },
      { id: user.id, name: user.name, email: user.email }
    ) || (await isProjectUser(user.id, task.projectId));

  return { task: base, canManage: false, canCheck };
}

export function toInitials(name: string): string {
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "U"
  );
}

/** Writes one line to the task's activity feed; never fails the calling action. */
export async function logTaskActivity(taskId: string, user: ActingUser, actionText: string): Promise<void> {
  try {
    await d.projectTaskActivity.create({
      data: {
        taskId,
        userId: user.id,
        userName: user.name,
        userInitials: toInitials(user.name),
        actionText,
      },
    });
  } catch (err) {
    console.error("Failed to log checklist activity:", err);
  }
}
