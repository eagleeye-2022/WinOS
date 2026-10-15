/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isTaskDone } from "@/features/projects/types";
import {
  LEARNING_CODE_PREFIX,
  LEARNING_DONE_STATUSES,
  LEARNING_PHASE_CODE,
  LEARNING_PHASE_NAME,
  LEARNING_PROJECT_CATEGORY,
  LEARNING_TASK_STATUSES,
  normalizeDueDate,
} from "./constants";

// Learning data lives in the Projects tables — see constants.ts for the mapping.
const d = db as any;

const WHYFI_PATH = "/pulse/whyfi-learning";

export type WhyfiUser = { id: string; name: string; email: string };

export type WhyfiTask = {
  id: string;
  code: string;
  title: string;
  description: string;
  status: string;
  dueDate: string;
  authorId: string | null;
  authorName: string;
  owners: WhyfiUser[];
  /** Minutes logged on this card by everyone / by the current user. */
  loggedMinutes: number;
  myLoggedMinutes: number;
  createdAt: string;
  parentTaskId: string | null;
  /** Nested subtasks (same shape, any depth — like project tasks). */
  subtasks: WhyfiTask[];
};

export type WhyfiList = {
  id: string;
  code: string;
  name: string;
  description: string;
  createdAt: string;
  members: WhyfiUser[];
  tasks: WhyfiTask[];
};

export type WhyfiWorkspace = {
  isManager: boolean;
  currentUserId: string;
  lists: WhyfiList[];
  /** Everyone a list can be shared with — only filled for managers. */
  users: WhyfiUser[];
};

type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

/** Same manager tier the Projects module uses (role MANAGER/ADMIN/SUPER_ADMIN/PROJECT_MANAGER or
 *  profileRole ADMIN). */
async function getActor(): Promise<{ id: string; name: string; isManager: boolean } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await d.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, profileRole: true },
  });
  // Stale JWT pointing at a deleted user (common after a local DB reset).
  if (!user) return null;
  const isManager =
    ["MANAGER", "ADMIN", "SUPER_ADMIN", "PROJECT_MANAGER"].includes(String(user.role).toUpperCase()) ||
    user.profileRole === "ADMIN";
  return { id: user.id, name: user.name || user.email || "User", isManager };
}

function toUser(u: { id: string; name: string | null; email: string }): WhyfiUser {
  return { id: u.id, name: u.name || u.email, email: u.email };
}

function toInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

/** A learning list the actor may see: managers see every list, members only lists shared with them. */
async function findVisibleList(projectId: string, actor: { id: string; isManager: boolean }) {
  return d.project.findFirst({
    where: {
      id: projectId,
      projectCategory: LEARNING_PROJECT_CATEGORY,
      ...(actor.isManager ? {} : { members: { some: { userId: actor.id } } }),
    },
    select: { id: true, code: true, name: true },
  });
}

async function findLearningTask(taskId: string) {
  return d.projectTask.findFirst({
    where: { id: taskId, project: { projectCategory: LEARNING_PROJECT_CATEGORY } },
    select: {
      id: true,
      code: true,
      title: true,
      authorId: true,
      projectId: true,
      owners: { select: { userId: true } },
    },
  });
}

async function logTaskActivity(taskId: string, actor: { id: string; name: string }, actionText: string) {
  await d.projectTaskActivity.create({
    data: {
      userName: actor.name,
      userId: actor.id,
      userInitials: toInitials(actor.name),
      actionText,
      taskId,
    },
  });
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getWhyfiWorkspaceAction(): Promise<WhyfiWorkspace | null> {
  const actor = await getActor();
  if (!actor) return null;

  const projects = await d.project.findMany({
    where: {
      projectCategory: LEARNING_PROJECT_CATEGORY,
      ...(actor.isManager ? {} : { members: { some: { userId: actor.id } } }),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      createdAt: true,
      members: {
        select: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      },
      // Every task incl. subtasks (any depth); the tree is built below.
      tasks: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          code: true,
          title: true,
          description: true,
          status: true,
          dueDate: true,
          authorId: true,
          authorName: true,
          createdAt: true,
          parentTaskId: true,
          owners: { select: { user: { select: { id: true, name: true, email: true } } } },
        },
      },
    },
  });

  const taskIds: string[] = projects.flatMap((p: any) => p.tasks.map((t: any) => t.id));
  const [totals, mine] = taskIds.length
    ? await Promise.all([
        d.projectTimeLog.groupBy({ by: ["taskId"], where: { taskId: { in: taskIds } }, _sum: { duration: true } }),
        d.projectTimeLog.groupBy({
          by: ["taskId"],
          where: { taskId: { in: taskIds }, userId: actor.id },
          _sum: { duration: true },
        }),
      ])
    : [[], []];
  const totalByTask = new Map<string, number>(totals.map((r: any) => [r.taskId, r._sum.duration || 0]));
  const mineByTask = new Map<string, number>(mine.map((r: any) => [r.taskId, r._sum.duration || 0]));

  const users = actor.isManager
    ? (
        await d.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        })
      ).map(toUser)
    : [];

  return {
    isManager: actor.isManager,
    currentUserId: actor.id,
    users,
    lists: projects.map((p: any) => ({
      id: p.id,
      code: p.code || p.id,
      name: p.name,
      description: p.description || "",
      createdAt: p.createdAt.toISOString(),
      members: p.members.map((m: any) => toUser(m.user)),
      tasks: buildTaskTree(
        p.tasks.map(
          (t: any): WhyfiTask => ({
            id: t.id,
            code: t.code,
            title: t.title,
            description: t.description || "",
            status: t.status,
            dueDate: normalizeDueDate(t.dueDate),
            authorId: t.authorId,
            authorName: t.authorName || "",
            owners: t.owners.map((o: any) => toUser(o.user)),
            loggedMinutes: totalByTask.get(t.id) || 0,
            myLoggedMinutes: mineByTask.get(t.id) || 0,
            createdAt: t.createdAt.toISOString(),
            parentTaskId: t.parentTaskId,
            subtasks: [],
          })
        )
      ),
    })),
  };
}

/** Nests a flat, already-ordered task list by parentTaskId. A task whose parent isn't in the
 *  list is treated as top-level so nothing is ever hidden. */
function buildTaskTree(flat: WhyfiTask[]): WhyfiTask[] {
  const byId = new Map(flat.map((t) => [t.id, t]));
  const roots: WhyfiTask[] = [];
  for (const t of flat) {
    const parent = t.parentTaskId ? byId.get(t.parentTaskId) : undefined;
    if (parent) parent.subtasks.push(t);
    else roots.push(t);
  }
  return roots;
}

export type WhyfiPickerTask = {
  id: string;
  code: string;
  title: string;
  status: string;
  projectId: string;
  listName: string;
  /** "YYYY-MM-DD", or "" when the card has no due date. */
  dueDate: string;
};

/**
 * Open learning cards for the DSM learning rows. By default: the current user's (managers see
 * every list). `forUserId` (managers only, e.g. on a member's DSM review): only the cards in
 * lists shared with that member.
 */
export async function getMyWhyfiTasksAction(forUserId?: string): Promise<WhyfiPickerTask[]> {
  const actor = await getActor();
  if (!actor) return [];

  const viewingMember = Boolean(forUserId && forUserId !== actor.id);
  if (viewingMember && !actor.isManager) return [];
  // Restrict to lists shared with this user; a manager viewing their own DSM sees every list.
  const scopeUserId = viewingMember ? forUserId! : actor.isManager ? null : actor.id;

  // Cards and their subtasks (learners usually work on the subtasks).
  const tasks = await d.projectTask.findMany({
    where: {
      status: { notIn: LEARNING_DONE_STATUSES },
      project: {
        projectCategory: LEARNING_PROJECT_CATEGORY,
        ...(scopeUserId ? { members: { some: { userId: scopeUserId } } } : {}),
      },
    },
    orderBy: [{ projectId: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      dueDate: true,
      projectId: true,
      project: { select: { name: true } },
      parentTask: { select: { title: true } },
    },
  });

  return tasks.map((t: any) => ({
    id: t.id,
    code: t.code,
    title: t.parentTask ? `${t.parentTask.title} › ${t.title}` : t.title,
    status: t.status,
    projectId: t.projectId,
    listName: t.project?.name || "",
    dueDate: normalizeDueDate(t.dueDate),
  }));
}

/**
 * Whyfi School cards by code (open or done) — for showing linked DSM learning lines ("[WL-1-T3] …")
 * with their list, status, due date and timer. Same visibility as the picker.
 */
export async function getWhyfiTasksByCodesAction(codes: string[]): Promise<WhyfiPickerTask[]> {
  const actor = await getActor();
  const wanted = Array.from(new Set(codes.filter(Boolean)));
  if (!actor || wanted.length === 0) return [];

  const tasks = await d.projectTask.findMany({
    where: {
      code: { in: wanted },
      project: {
        projectCategory: LEARNING_PROJECT_CATEGORY,
        ...(actor.isManager ? {} : { members: { some: { userId: actor.id } } }),
      },
    },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      dueDate: true,
      projectId: true,
      project: { select: { name: true } },
      parentTask: { select: { title: true } },
    },
  });

  return tasks.map((t: any) => ({
    id: t.id,
    code: t.code,
    title: t.parentTask ? `${t.parentTask.title} › ${t.title}` : t.title,
    status: t.status,
    projectId: t.projectId,
    listName: t.project?.name || "",
    dueDate: normalizeDueDate(t.dueDate),
  }));
}

/**
 * Manager picks a Whyfi School card for a member from their DSM review: adds the member as an
 * owner of the card (existing owners are kept) and shares the card's list with them if it isn't
 * already, so they can see it, pick it in their DSM and run its timer.
 */
export async function assignWhyfiTaskToMemberAction(taskId: string, memberId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "Unauthorized" };
  if (!actor.isManager) return { success: false, error: "Only a manager can assign learning tasks." };

  const task = await findLearningTask(taskId);
  if (!task) return { success: false, error: "Learning task not found." };
  const member = await d.user.findUnique({ where: { id: memberId }, select: { id: true, name: true, email: true } });
  if (!member) return { success: false, error: "That team member could not be found." };

  const ownerIds: string[] = task.owners.map((o: { userId: string }) => o.userId);
  if (!ownerIds.includes(member.id)) {
    await d.projectTaskOwner.create({ data: { taskId: task.id, userId: member.id, assignedById: actor.id } });
    if (ownerIds.length === 0) {
      await d.projectTask.update({
        where: { id: task.id },
        data: { ownerId: member.id, owner: member.name || member.email, lastActivityDate: new Date() },
      });
    }
    await logTaskActivity(task.id, actor, `assigned this task to ${member.name || member.email} from DSM`);
  }

  await d.projectMember.createMany({
    data: [{ projectId: task.projectId, userId: member.id, projectRole: "Learner" }],
    skipDuplicates: true,
  });

  revalidatePath(WHYFI_PATH);
  return { success: true, data: undefined };
}

/** Ids of a task and all its descendants. */
async function subtreeIds(rootId: string): Promise<string[]> {
  const ids = [rootId];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children: { id: string }[] = await d.projectTask.findMany({
      where: { parentTaskId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id);
    ids.push(...frontier);
  }
  return ids;
}

export type WhyfiTimelineEntry = {
  id: string;
  date: string; // ISO timestamp of the log
  minutes: number;
  userId: string;
  userName: string;
  taskId: string;
  taskCode: string;
  taskTitle: string;
  taskStatus: string;
  listName: string;
};

/**
 * Learning effort (time logs on learning cards) between two dates, newest first. Managers see
 * everyone's (optionally one member's); members only ever see their own.
 */
export async function getWhyfiTimelineAction(params: {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  userId?: string;
}): Promise<WhyfiTimelineEntry[]> {
  const actor = await getActor();
  if (!actor) return [];

  const from = new Date(`${params.from}T00:00:00.000Z`);
  const to = new Date(`${params.to}T23:59:59.999Z`);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return [];

  const userFilter = actor.isManager ? params.userId || undefined : actor.id;

  const logs = await d.projectTimeLog.findMany({
    where: {
      project: { projectCategory: LEARNING_PROJECT_CATEGORY },
      date: { gte: from, lte: to },
      ...(userFilter ? { userId: userFilter } : {}),
    },
    orderBy: { date: "desc" },
    take: 1000,
    select: {
      id: true,
      date: true,
      duration: true,
      userId: true,
      user: { select: { name: true, email: true } },
      task: { select: { id: true, code: true, title: true, status: true } },
      project: { select: { name: true } },
    },
  });

  return logs.map((l: any) => ({
    id: l.id,
    date: l.date.toISOString(),
    minutes: l.duration,
    userId: l.userId,
    userName: l.user?.name || l.user?.email || "User",
    taskId: l.task?.id || "",
    taskCode: l.task?.code || "",
    taskTitle: l.task?.title || "",
    taskStatus: l.task?.status || "",
    listName: l.project?.name || "",
  }));
}

// ── Lists (manager only) ──────────────────────────────────────────────────────

async function nextLearningProjectCode(): Promise<string> {
  const rows = await d.project.findMany({
    where: { code: { startsWith: `${LEARNING_CODE_PREFIX}-` } },
    select: { code: true },
  });
  let max = 0;
  for (const row of rows) {
    const match = row.code?.match(new RegExp(`^${LEARNING_CODE_PREFIX}-(\\d+)$`));
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${LEARNING_CODE_PREFIX}-${max + 1}`;
}

export async function createWhyfiListAction(input: {
  name: string;
  description?: string;
}): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "Unauthorized" };
  if (!actor.isManager) return { success: false, error: "Only a manager can create a learning task list." };

  const name = input.name.trim();
  if (!name) return { success: false, error: "Give the task list a name." };

  const code = await nextLearningProjectCode();
  const project = await d.project.create({
    data: {
      code,
      name,
      description: input.description?.trim() || null,
      projectCategory: LEARNING_PROJECT_CATEGORY,
      departmentAlias: null,
      templateUsed: null,
      accessType: "PRIVATE",
      isClientVisible: false,
      status: "ACTIVE",
      ownerId: actor.id,
      ownerName: actor.name,
      ownerInitials: toInitials(actor.name),
      createdByUserId: actor.id,
    },
    select: { id: true },
  });
  await d.projectPhase.create({
    data: {
      code: LEARNING_PHASE_CODE,
      name: LEARNING_PHASE_NAME,
      order: 0,
      ownerId: actor.id,
      projectId: project.id,
    },
  });
  await d.projectTaskList.create({
    data: {
      name: LEARNING_PHASE_NAME,
      flag: "internal",
      status: "Active",
      sequence: 1,
      phaseCode: LEARNING_PHASE_CODE,
      projectId: project.id,
    },
  });

  revalidatePath(WHYFI_PATH);
  return { success: true, data: { id: project.id } };
}

export async function updateWhyfiListAction(
  projectId: string,
  input: { name?: string; description?: string }
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "Unauthorized" };
  if (!actor.isManager) return { success: false, error: "Only a manager can edit a learning task list." };
  if (!(await findVisibleList(projectId, actor))) return { success: false, error: "Task list not found." };

  const data: Record<string, string | null> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { success: false, error: "Give the task list a name." };
    data.name = name;
  }
  if (input.description !== undefined) data.description = input.description.trim() || null;

  await d.project.update({ where: { id: projectId }, data });
  revalidatePath(WHYFI_PATH);
  return { success: true, data: undefined };
}

/** Deletes a list and its cards. Refused once anyone has logged time on it, since deleting
 *  would also delete that effort from their logs. */
export async function deleteWhyfiListAction(projectId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "Unauthorized" };
  if (!actor.isManager) return { success: false, error: "Only a manager can delete a learning task list." };
  if (!(await findVisibleList(projectId, actor))) return { success: false, error: "Task list not found." };

  const [logCount, timerCount] = await Promise.all([
    d.projectTimeLog.count({ where: { projectId } }),
    d.activeTimer.count({ where: { projectId } }),
  ]);
  if (logCount > 0 || timerCount > 0) {
    return {
      success: false,
      error: "Time has already been logged on this list, so it can't be deleted (that would erase the effort log).",
    };
  }

  await d.project.delete({ where: { id: projectId } });
  revalidatePath(WHYFI_PATH);
  return { success: true, data: undefined };
}

/** Shares a list with exactly `userIds` (adds new members, removes ones no longer selected). */
export async function setWhyfiListMembersAction(projectId: string, userIds: string[]): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "Unauthorized" };
  if (!actor.isManager) return { success: false, error: "Only a manager can share a learning task list." };
  if (!(await findVisibleList(projectId, actor))) return { success: false, error: "Task list not found." };

  const wanted = Array.from(new Set(userIds));
  const existing: { userId: string }[] = await d.projectMember.findMany({
    where: { projectId },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((m) => m.userId));
  const toAdd = wanted.filter((id) => !existingIds.has(id));
  const toRemove = [...existingIds].filter((id) => !wanted.includes(id));

  if (toRemove.length > 0) {
    await d.projectMember.deleteMany({ where: { projectId, userId: { in: toRemove } } });
  }
  if (toAdd.length > 0) {
    await d.projectMember.createMany({
      data: toAdd.map((userId) => ({ projectId, userId, projectRole: "Learner" })),
      skipDuplicates: true,
    });
    const list = await d.project.findUnique({ where: { id: projectId }, select: { name: true } });
    await d.notification.createMany({
      data: toAdd.map((userId) => ({
        type: "PROJECT_ASSIGNED",
        title: "Learning task list shared with you",
        message: `${actor.name} shared the Whyfi School list "${list?.name || ""}" with you.`,
        userId,
        createdById: actor.id,
        relatedEntryId: projectId,
      })),
    });
  }

  revalidatePath(WHYFI_PATH);
  return { success: true, data: undefined };
}

// ── Cards ─────────────────────────────────────────────────────────────────────

async function nextLearningTaskCode(projectId: string, projectCode: string): Promise<string> {
  const rows: { code: string }[] = await d.projectTask.findMany({ where: { projectId }, select: { code: true } });
  let max = 0;
  for (const row of rows) {
    const match = row.code.match(/-T(\d+)$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${projectCode}-T${max + 1}`;
}

/** Managers create cards for anyone; members can add cards to lists shared with them (the card
 *  is then theirs). */
export async function createWhyfiTaskAction(
  projectId: string,
  input: { title: string; description?: string; dueDate?: string; ownerIds?: string[]; parentTaskId?: string }
): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "Unauthorized" };
  const list = await findVisibleList(projectId, actor);
  if (!list) return { success: false, error: "Task list not found or not shared with you." };

  const title = input.title.trim();
  if (!title) return { success: false, error: "Give the card a title." };

  if (input.parentTaskId) {
    const parent = await d.projectTask.findFirst({
      where: { id: input.parentTaskId, projectId },
      select: { id: true },
    });
    if (!parent) return { success: false, error: "Parent task not found in this list." };
  }

  const phase = await d.projectPhase.findFirst({
    where: { projectId },
    orderBy: { order: "asc" },
    select: { id: true, code: true, name: true },
  });

  const ownerIds = actor.isManager ? Array.from(new Set(input.ownerIds || [])) : [actor.id];
  const owners: { id: string; name: string | null; email: string }[] = ownerIds.length
    ? await d.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true, email: true } })
    : [];
  const primary = owners[0];

  const task = await d.projectTask.create({
    data: {
      code: await nextLearningTaskCode(projectId, list.code || list.id),
      title,
      description: input.description?.trim() || "",
      phaseId: phase?.id,
      phaseCode: phase?.code || LEARNING_PHASE_CODE,
      phaseName: phase?.name || LEARNING_PHASE_NAME,
      taskListName: LEARNING_PHASE_NAME,
      isExternal: false,
      status: "Open",
      authorId: actor.id,
      authorName: actor.name,
      departmentAlias: null,
      dueDate: input.dueDate || "--",
      ownerId: primary?.id ?? null,
      owner: owners.length ? owners.map((o) => o.name || o.email).join(", ") : "Unassigned",
      projectId,
      parentTaskId: input.parentTaskId || null,
    },
    select: { id: true },
  });

  if (owners.length > 0) {
    await d.projectTaskOwner.createMany({
      data: owners.map((o) => ({ taskId: task.id, userId: o.id, assignedById: actor.id })),
      skipDuplicates: true,
    });
  }
  await logTaskActivity(task.id, actor, "created this task");

  revalidatePath(WHYFI_PATH);
  return { success: true, data: { id: task.id } };
}

/**
 * Managers can change anything. Members (who must have the list shared with them) can change the
 * status and due date of cards assigned to them or to nobody, and edit the title/description of
 * cards they added themselves. Only managers reassign cards.
 */
export async function updateWhyfiTaskAction(
  taskId: string,
  input: { status?: string; title?: string; description?: string; dueDate?: string; ownerIds?: string[] }
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "Unauthorized" };
  const task = await findLearningTask(taskId);
  if (!task || !(await findVisibleList(task.projectId, actor))) {
    return { success: false, error: "Card not found or not shared with you." };
  }

  const ownerIds: string[] = task.owners.map((o: { userId: string }) => o.userId);
  const isAuthor = task.authorId === actor.id;
  const canChangeStatus = actor.isManager || ownerIds.length === 0 || ownerIds.includes(actor.id);
  const canEditDetails = actor.isManager || isAuthor;

  const data: Record<string, unknown> = {};
  const changes: string[] = [];

  if (input.status !== undefined && input.status !== null) {
    if (!canChangeStatus) return { success: false, error: "Only the people this card is assigned to can change its status." };
    if (!LEARNING_TASK_STATUSES.includes(input.status)) {
      return { success: false, error: "Unknown status." };
    }
    data.status = input.status;
    data.completionPercentage = isTaskDone(input.status) ? 100 : 0;
    changes.push(`changed status to ${input.status}`);
  }
  if (input.title !== undefined || input.description !== undefined) {
    if (!canEditDetails) return { success: false, error: "Only a manager or the card's author can edit it." };
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) return { success: false, error: "Give the card a title." };
      data.title = title;
      changes.push("renamed this task");
    }
    if (input.description !== undefined) data.description = input.description.trim();
  }
  // The due date can also be set by whoever works on the card (e.g. from their DSM learning row).
  if (input.dueDate !== undefined) {
    if (!canEditDetails && !canChangeStatus) {
      return { success: false, error: "Only the people this card is assigned to can change its due date." };
    }
    const due = normalizeDueDate(input.dueDate);
    if (input.dueDate && !due) return { success: false, error: "Invalid due date." };
    data.dueDate = due || "--";
    changes.push(due ? `set the due date to ${due}` : "cleared the due date");
  }

  if (input.ownerIds !== undefined) {
    if (!actor.isManager) return { success: false, error: "Only a manager can assign cards." };
    const wanted = Array.from(new Set(input.ownerIds));
    const users: { id: string; name: string | null; email: string }[] = wanted.length
      ? await d.user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true, email: true } })
      : [];
    data.ownerId = users[0]?.id ?? null;
    data.owner = users.length ? users.map((u) => u.name || u.email).join(", ") : "Unassigned";

    const toRemove = ownerIds.filter((id) => !wanted.includes(id));
    const toAdd = users.map((u) => u.id).filter((id) => !ownerIds.includes(id));
    if (toRemove.length > 0) {
      await d.projectTaskOwner.deleteMany({ where: { taskId: task.id, userId: { in: toRemove } } });
    }
    if (toAdd.length > 0) {
      await d.projectTaskOwner.createMany({
        data: toAdd.map((userId) => ({ taskId: task.id, userId, assignedById: actor.id })),
        skipDuplicates: true,
      });
    }
    changes.push("changed the assignees");
  }

  if (Object.keys(data).length > 0) {
    data.lastActivityDate = new Date();
    await d.projectTask.update({ where: { id: task.id }, data });
  }
  for (const change of changes) await logTaskActivity(task.id, actor, change);

  revalidatePath(WHYFI_PATH);
  return { success: true, data: undefined };
}

/** Managers, or the member who added the card. Refused once time is logged on it, since deleting
 *  would erase that effort. */
export async function deleteWhyfiTaskAction(taskId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "Unauthorized" };
  const task = await findLearningTask(taskId);
  if (!task || !(await findVisibleList(task.projectId, actor))) {
    return { success: false, error: "Card not found or not shared with you." };
  }
  if (!actor.isManager && task.authorId !== actor.id) {
    return { success: false, error: "Only a manager or the card's author can delete it." };
  }

  // Deleting a task also deletes its subtasks (cascade), so check the whole subtree.
  const ids = await subtreeIds(task.id);
  const [logCount, timerCount] = await Promise.all([
    d.projectTimeLog.count({ where: { taskId: { in: ids } } }),
    d.activeTimer.count({ where: { taskId: { in: ids } } }),
  ]);
  if (logCount > 0 || timerCount > 0) {
    return {
      success: false,
      error: "Time has already been logged on this task or its subtasks, so it can't be deleted. Mark it Done instead.",
    };
  }

  await d.projectTask.delete({ where: { id: task.id } });
  revalidatePath(WHYFI_PATH);
  return { success: true, data: undefined };
}
