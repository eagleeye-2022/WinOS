"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasModuleAccess } from "@/features/users/actions/module-guard";
import { DEFAULT_PROJECT_PHASES } from "@/features/projects/data/mock-projects";
import { DELETED_TASK_LIST_STATUS, isTaskDone } from "@/features/projects/types";
import { NAT_TASK_LIST_NAME } from "../utils";
import type { CascadingTaskOption } from "../queries";

const MAX_TASK_TITLE = 300;
const MANAGER_ROLES = new Set(["MANAGER", "ADMIN", "SUPER_ADMIN", "PROJECT_MANAGER"]);

type Failure = { success: false; error: string };

type EditableProject = {
  user: { id: string; name: string };
  project: { id: string; code: string | null };
  isManager: boolean;
};

/**
 * Resolves a project the current user may add tasks to from the DSM picker (task lists can't be
 * created from the DSM — that's done on the project's board):
 * managers can add to any project; everyone else only to projects that appear in their own
 * picker (same membership rule as `getUserProjectsWithTasksAndSubtasks`).
 */
async function resolveEditableProject(projectId: string): Promise<EditableProject | Failure> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (!(await hasModuleAccess("PROJECTS"))) {
    return { success: false, error: "You don't have access to Projects." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  // Re-query the user — guards against a stale JWT pointing at a deleted user.
  const user = await d.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, profileRole: true },
  });
  if (!user) return { success: false, error: "Your account could not be found. Please sign in again." };

  const isManager = MANAGER_ROLES.has(String(user.role).toUpperCase()) || user.profileRole === "ADMIN";
  const userId = user.id as string;

  const project = await d.project.findFirst({
    where: {
      id: projectId,
      ...(isManager
        ? {}
        : {
            OR: [
              { ownerId: userId },
              { createdByUserId: userId },
              { members: { some: { userId } } },
              { roleAssignments: { some: { userId } } },
              { tasks: { some: { OR: [{ ownerId: userId }, { owners: { some: { userId } } }] } } },
            ],
          }),
    },
    select: { id: true, code: true },
  });
  if (!project) return { success: false, error: "You can't add to this project." };

  return { user: { id: userId, name: user.name || user.email || "User" }, project, isManager };
}

/**
 * Creates a task in one of a project's task lists from the DSM picker. Owned by the current
 * user, or — when a manager adds it from a member's review page — by `ownerUserId`.
 */
export async function createDsmProjectTaskAction(
  projectId: string,
  input: { title: string; taskListCode: string; ownerUserId?: string }
): Promise<{ success: true; task: CascadingTaskOption } | Failure> {
  const title = input.title.trim();
  if (!title) return { success: false, error: "Task title is required." };
  if (title.length > MAX_TASK_TITLE) {
    return { success: false, error: `Task title must be ${MAX_TASK_TITLE} characters or fewer.` };
  }
  if (!input.taskListCode) return { success: false, error: "Pick a task list first." };

  const ctx = await resolveEditableProject(projectId);
  if ("success" in ctx) return ctx;
  const { user, project, isManager } = ctx;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  let owner = user;
  if (input.ownerUserId && input.ownerUserId !== user.id) {
    if (!isManager) return { success: false, error: "Only a manager can create a task for someone else." };
    const target = await d.user.findUnique({
      where: { id: input.ownerUserId },
      select: { id: true, name: true, email: true },
    });
    if (!target) return { success: false, error: "That team member could not be found." };
    owner = { id: target.id, name: target.name || target.email || "User" };
  }

  const phase = await d.projectPhase.findFirst({
    where: { projectId: project.id, code: input.taskListCode },
    select: { id: true, name: true },
  });
  const defaultPhase = DEFAULT_PROJECT_PHASES.find((p) => p.code === input.taskListCode);
  const taskList = await d.projectTaskList.findFirst({
    where: { projectId: project.id, phaseCode: input.taskListCode },
    select: { id: true, name: true, status: true },
  });
  if (taskList?.status === DELETED_TASK_LIST_STATUS) {
    return { success: false, error: "That task list no longer exists." };
  }
  const phaseName: string | undefined = phase?.name ?? defaultPhase?.name ?? taskList?.name;
  if (!phaseName) {
    // Not a DB phase or default phase — accept it only if tasks already live in that list.
    const existing = await d.projectTask.findFirst({
      where: { projectId: project.id, phaseCode: input.taskListCode },
      select: { phaseName: true },
    });
    if (!existing) return { success: false, error: "That task list no longer exists." };
  }

  // Same task-code scheme as createTaskAction in the Projects module.
  const count: number = await d.projectTask.count({ where: { projectId: project.id } });
  const code = `${project.code || "TASK"}-T${count + 1}`;

  const created = await d.projectTask.create({
    data: {
      code,
      title,
      projectId: project.id,
      phaseId: phase?.id,
      phaseCode: input.taskListCode,
      phaseName: phaseName ?? input.taskListCode,
      taskListId: taskList?.id,
      taskListName: taskList?.name,
      status: "Open",
      authorId: user.id,
      authorName: user.name,
      ownerId: owner.id,
      owner: owner.name,
    },
    select: { id: true, code: true, title: true, status: true, phaseCode: true },
  });

  await d.projectTaskOwner.create({
    data: { taskId: created.id, userId: owner.id, assignedById: user.id },
  });
  await d.projectTaskActivity.create({
    data: {
      userId: user.id,
      userName: user.name,
      userInitials: initials(user.name),
      actionText: "created this task from DSM",
      taskId: created.id,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/dsm");
  return { success: true, task: { ...created, subtasks: [] } };
}

/** A DSM row's text as a task title: whitespace collapsed, shortened if longer than a title allows. */
function toTaskTitle(rawTitle: string): string {
  const title = rawTitle.trim().replace(/\s+/g, " ");
  return title.length > MAX_TASK_TITLE ? `${title.slice(0, MAX_TASK_TITLE - 1).trimEnd()}…` : title;
}

/**
 * Gives a DSM row that has a project but no task list or task a task to link to: the current
 * user's task named after the row in the project's "Not Aligned Task (NAT)" list. Reuses their
 * open NAT task with the same title (so starting the timer, then submitting, doesn't pile up
 * duplicates), otherwise creates one there owned by them. Used when the timer is started on
 * such a row and when the DSM is submitted. Time logged on it shows in the NAT column on the
 * board, where a manager aligns it by moving the task to the right list — its time logs move
 * with it.
 */
export async function ensureNatTaskForTimerAction(
  projectId: string,
  rawTitle: string
): Promise<{ success: true; task: CascadingTaskOption; taskListCode: string; created: boolean } | Failure> {
  const title = toTaskTitle(rawTitle);
  if (!title) return { success: false, error: "Write what you're working on first." };

  const ctx = await resolveEditableProject(projectId);
  if ("success" in ctx) return ctx;
  const { user, project } = ctx;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const natPhases: { code: string }[] = await d.projectPhase.findMany({
    where: { projectId: project.id, name: { equals: NAT_TASK_LIST_NAME, mode: "insensitive" } },
    select: { code: true },
    orderBy: { order: "asc" },
  });
  let natCode: string | null = null;
  for (const ph of natPhases) {
    const deleted = await d.projectTaskList.findFirst({
      where: { projectId: project.id, phaseCode: ph.code, status: DELETED_TASK_LIST_STATUS },
      select: { id: true },
    });
    if (!deleted) {
      natCode = ph.code;
      break;
    }
  }
  if (!natCode) {
    return {
      success: false,
      error: `This project has no "${NAT_TASK_LIST_NAME}" task list. Pick a task to start the timer.`,
    };
  }

  const res = await findOrCreateOwnTaskInList(project.id, user.id, title, natCode);
  if (!res.success) return res;
  return { ...res, taskListCode: natCode };
}

/**
 * Links a DSM task row that has a project and a task list but no task: finds the current user's
 * open task with the row's text in that list, or creates it there (owned by them). Used when a
 * DSM is submitted, so every such row ends up linked to a real task. Text longer than a task
 * title allows is shortened.
 */
export async function linkOrCreateDsmTaskAction(
  projectId: string,
  rawTitle: string,
  taskListCode: string
): Promise<{ success: true; task: CascadingTaskOption; created: boolean } | Failure> {
  const title = toTaskTitle(rawTitle);
  if (!title) return { success: false, error: "Task text is required." };
  if (!taskListCode) return { success: false, error: "Pick a task list first." };

  const ctx = await resolveEditableProject(projectId);
  if ("success" in ctx) return ctx;
  return findOrCreateOwnTaskInList(ctx.project.id, ctx.user.id, title, taskListCode);
}

/**
 * The user's open (not done) top-level task named `title` in task list `listCode`, or a new one
 * created there via createDsmProjectTaskAction. Callers must have already checked the user may
 * add to the project (resolveEditableProject).
 */
async function findOrCreateOwnTaskInList(
  projectDbId: string,
  userId: string,
  title: string,
  listCode: string
): Promise<{ success: true; task: CascadingTaskOption; created: boolean } | Failure> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const candidates: (CascadingTaskOption & { completionPercentage: number })[] = await d.projectTask.findMany({
    where: {
      projectId: projectDbId,
      phaseCode: listCode,
      parentTaskId: null,
      title: { equals: title, mode: "insensitive" },
      owners: { some: { userId } },
    },
    select: { id: true, code: true, title: true, status: true, phaseCode: true, completionPercentage: true },
    orderBy: { createdAt: "desc" },
  });
  const open = candidates.find((t) => !isTaskDone(t.status, undefined, t.completionPercentage));
  if (open) {
    const task = { id: open.id, code: open.code, title: open.title, status: open.status, phaseCode: open.phaseCode };
    return { success: true, task: { ...task, subtasks: [] }, created: false };
  }

  const res = await createDsmProjectTaskAction(projectDbId, { title, taskListCode: listCode });
  if (!res.success) return res;
  return { success: true, task: res.task, created: true };
}

function initials(name: string): string {
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "U"
  );
}
