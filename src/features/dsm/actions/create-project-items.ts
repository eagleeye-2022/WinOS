"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasModuleAccess } from "@/features/users/actions/module-guard";
import { createProjectTaskListAction } from "@/features/projects/actions/project-actions";
import { DEFAULT_PROJECT_PHASES } from "@/features/projects/data/mock-projects";
import { formatTaskListName, nextTaskListCode, type TaskListOption } from "../utils";
import type { CascadingTaskOption } from "../queries";

const MAX_TASK_LIST_NAME = 120;
const MAX_TASK_TITLE = 300;
const MANAGER_ROLES = new Set(["MANAGER", "ADMIN", "SUPER_ADMIN", "PROJECT_MANAGER"]);

type Failure = { success: false; error: string };

type EditableProject = {
  user: { id: string; name: string };
  project: { id: string; code: string | null };
};

/**
 * Resolves a project the current user may add task lists / tasks to from the DSM picker:
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

  return { user: { id: userId, name: user.name || user.email || "User" }, project };
}

/** Creates a new task list (board phase column) in a project from the DSM picker. */
export async function createDsmTaskListAction(
  projectId: string,
  rawName: string
): Promise<{ success: true; taskList: TaskListOption } | Failure> {
  const name = rawName.trim();
  if (!name) return { success: false, error: "Task list name is required." };
  if (name.length > MAX_TASK_LIST_NAME) {
    return { success: false, error: `Task list name must be ${MAX_TASK_LIST_NAME} characters or fewer.` };
  }

  const ctx = await resolveEditableProject(projectId);
  if ("success" in ctx) return ctx;

  // A project with no phases yet gets the default set seeded first (inside
  // createProjectTaskListAction), so number the new list after those.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phases: { code: string }[] = await (db as any).projectPhase.findMany({
    where: { projectId: ctx.project.id },
    select: { code: true },
  });
  const existingCodes = phases.length > 0 ? phases.map((p) => p.code) : DEFAULT_PROJECT_PHASES.map((p) => p.code);
  const code = nextTaskListCode(existingCodes);

  const res = await createProjectTaskListAction(ctx.project.id, { name: formatTaskListName(code, name), code });
  if (!res.success || !res.phase) {
    return { success: false, error: res.error || "Could not create the task list." };
  }

  revalidatePath("/dsm");
  return { success: true, taskList: { code: res.phase.code, name: res.phase.name } };
}

/** Creates a task in one of a project's task lists, owned by the current user, from the DSM picker. */
export async function createDsmProjectTaskAction(
  projectId: string,
  input: { title: string; taskListCode: string }
): Promise<{ success: true; task: CascadingTaskOption } | Failure> {
  const title = input.title.trim();
  if (!title) return { success: false, error: "Task title is required." };
  if (title.length > MAX_TASK_TITLE) {
    return { success: false, error: `Task title must be ${MAX_TASK_TITLE} characters or fewer.` };
  }
  if (!input.taskListCode) return { success: false, error: "Pick a task list first." };

  const ctx = await resolveEditableProject(projectId);
  if ("success" in ctx) return ctx;
  const { user, project } = ctx;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const phase = await d.projectPhase.findFirst({
    where: { projectId: project.id, code: input.taskListCode },
    select: { id: true, name: true },
  });
  const defaultPhase = DEFAULT_PROJECT_PHASES.find((p) => p.code === input.taskListCode);
  const taskList = await d.projectTaskList.findFirst({
    where: { projectId: project.id, phaseCode: input.taskListCode },
    select: { id: true, name: true },
  });
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
      ownerId: user.id,
      owner: user.name,
    },
    select: { id: true, code: true, title: true, status: true, phaseCode: true },
  });

  await d.projectTaskOwner.create({
    data: { taskId: created.id, userId: user.id, assignedById: user.id },
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
