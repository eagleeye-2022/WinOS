"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  Project,
  TaskItem,
  TaskSubtask,
  TaskRemark,
  TimeLogEntry,
  UserTimeGroup,
  ProjectUser,
  NewProjectFormData,
  ProjectPriority,
  UserDepartment,
  BillingType,
  TaskStatus,
  WorkspaceRole,
  MemberRoleTier,
  ProfileRoleValue,
} from "../types";
import {
  DEFAULT_PROJECT_TEMPLATES,
  scaffoldPhasesFromTemplate,
  scaffoldTaskListsFromTemplate,
  scaffoldTasksFromTemplate,
} from "../data/sop-templates";

/**
 * Display label for each Prisma `ProfileRole` value — backs the "Portal Profile" column.
 */
const PROFILE_ROLE_LABELS: Record<ProfileRoleValue, string> = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  CONTRACTOR: "Contractor",
  CLIENT: "Client",
  GUEST: "Guest",
  DEVELOPER: "Developer",
  SUPPORT: "Support",
  ADMIN: "Admin",
  PORTAL_OWNER: "Portal Owner",
};

/**
 * Derives the 3-tier role badge shown on the Users screen from the global
 * `User.role` (TEAM_MEMBER|MANAGER, used site-wide for manager route gating — left untouched)
 * plus an ADMIN override from `User.profileRole`.
 */
function deriveMemberRoleTier(
  userRole: string | null | undefined,
  profileRole: string | null | undefined
): MemberRoleTier {
  if (profileRole === "ADMIN") return "ADMIN";
  if (userRole === "MANAGER") return "MANAGER";
  return "TEAM_MEMBER";
}

/**
 * Helper to ensure the current user is authenticated.
 */
async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized: Please sign in to access WinOS Projects.");
  }
  return {
    user: {
      id: session.user.id,
      name: session.user.name || "User",
      email: session.user.email || "",
    },
  };
}

/**
 * Whether a user can see time logs belonging to other users — mirrors the same
 * TEAM_MEMBER|MANAGER (+ ADMIN profile role) check used by getCurrentUserRoleAction.
 */
async function isPrivilegedViewer(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, profileRole: true },
  });
  if (!user || !user.role) return false;

  const roleStr = String(user.role).toUpperCase();
  return (
    roleStr === "ADMIN" ||
    roleStr === "SUPER_ADMIN" ||
    roleStr === "PROJECT_MANAGER" ||
    roleStr === "MANAGER" ||
    user.profileRole === "ADMIN"
  );
}

/**
 * ----------------------------------------------------
 * TASK OWNERSHIP (ProjectTaskOwner join table)
 * ----------------------------------------------------
 * The real, referentially-integrous source of truth for "who owns this task" — a proper
 * many-to-many relation (unique per task+user, FK-enforced, records who assigned whom and
 * when) replacing the old `owners`/`ownerIds` scalar-array columns. `ownerId`/`owner` on
 * ProjectTask remain as the single *primary* owner for legacy display/FK use.
 */

// Common Prisma `include` fragment for pulling every real owner (id + display name) of a task.
const TASK_OWNERS_INCLUDE = {
  owners: { include: { user: { select: { id: true, name: true, email: true } } } },
} as const;

type TaskOwnerRow = { userId: string; user: { name: string | null; email: string } };

/** Builds the `{ owners, ownerIds }` pair the client-facing TaskItem shape expects, from the
 *  join table first, falling back to legacy single-owner fields only for rows with no join rows. */
function resolveOwnersDisplay(
  relOwners: TaskOwnerRow[] | undefined,
  legacyOwnerUserName: string | null | undefined,
  legacyOwner: string | null | undefined,
  legacyOwnerId: string | null | undefined
): { owners: string[]; ownerIds: string[] } {
  if (relOwners && relOwners.length > 0) {
    return {
      owners: relOwners.map((o) => o.user.name || o.user.email),
      ownerIds: relOwners.map((o) => o.userId),
    };
  }
  if (legacyOwnerUserName) {
    return { owners: [legacyOwnerUserName], ownerIds: legacyOwnerId ? [legacyOwnerId] : [] };
  }
  if (legacyOwner && legacyOwner !== "Unassigned") {
    return { owners: [legacyOwner], ownerIds: legacyOwnerId ? [legacyOwnerId] : [] };
  }
  return { owners: [], ownerIds: [] };
}

/**
 * Replaces a task's owner set in the ProjectTaskOwner join table to match `userIds` exactly:
 * removes owners no longer selected, adds newly-selected ones (owners who stay are left
 * untouched, preserving their original assignedAt/assignedBy), de-dupes the input, and never
 * hardcodes a user ID — `assignedById` is always the actual authenticated actor.
 */
async function syncTaskOwners(taskDbId: string, userIds: string[], assignedById: string) {
  const uniqueIds = Array.from(new Set(userIds));
  const existing = await db.projectTaskOwner.findMany({
    where: { taskId: taskDbId },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((o) => o.userId));
  const toAdd = uniqueIds.filter((id) => !existingIds.has(id));
  const toRemove = existing.map((o) => o.userId).filter((id) => !uniqueIds.includes(id));

  if (toRemove.length > 0) {
    await db.projectTaskOwner.deleteMany({
      where: { taskId: taskDbId, userId: { in: toRemove } },
    });
  }
  if (toAdd.length > 0) {
    await db.projectTaskOwner.createMany({
      data: toAdd.map((userId) => ({ taskId: taskDbId, userId, assignedById })),
      skipDuplicates: true,
    });
  }
}

/**
 * ----------------------------------------------------
 * PROJECTS CRUD ACTIONS (AUTHENTICATED, NO MOCK SEEDING)
 * ----------------------------------------------------
 */

function toProject(p: {
  id: string;
  code: string | null;
  name: string;
  progressPercent: number;
  projectCategory: string | null;
  departmentAlias: string | null;
  templateUsed: string | null;
  isClientVisible: boolean;
  group: string | null;
  businessHours: string | null;
  taskLayout: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerAvatarColor: string | null;
  owner: { id: string; name: string | null } | null;
  status: string;
  totalHours: string | null;
  billableHours: string | null;
  nonBillableHours: string | null;
  startDate: string | null;
  deadline: string | null;
  description: string | null;
  tags: string[];
  createdAt: Date;
  phases: { id: string; code: string; name: string; isCompleted: boolean; ownerId: string | null }[];
  tasks: { status: string }[];
}): Project {
  const completedPhases = p.phases.filter((ph) => ph.isCompleted).length;
  const completedTasks = p.tasks.filter(
    (t) => t.status === "Closed" || t.status === "CLOSED"
  ).length;
  const totalTasks = p.tasks.length;

  const ownerName = p.owner?.name || p.ownerName || "Unassigned";
  const initials = ownerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return {
    id: p.code || p.id,
    name: p.name,
    progressPercent: p.progressPercent,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    projectCategory: (p.projectCategory as any) || "CLIENT_DELIVERY",
    departmentAlias: p.departmentAlias || "digitalproducts@",
    templateUsed: p.templateUsed || undefined,
    isClientVisible: p.isClientVisible,
    group: p.group || undefined,
    businessHours: p.businessHours || undefined,
    taskLayout: p.taskLayout || undefined,
    owner: {
      id: p.owner?.id || p.ownerId || "u-default",
      name: ownerName,
      initials: initials || "UN",
      avatarColor: p.ownerAvatarColor || "bg-primary text-primary-foreground",
    },
    status: p.status as "ACTIVE" | "COMPLETED" | "ARCHIVED",
    totalHours: p.totalHours || "00:00 h",
    billableHours: p.billableHours || "00:00 h",
    nonBillableHours: p.nonBillableHours || "00:00 h",
    startDate: p.startDate || new Date().toISOString().split("T")[0],
    deadline: p.deadline || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    completedTasksCount: completedTasks,
    totalTasksCount: totalTasks,
    taskProgressPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    completedPhasesCount: completedPhases,
    totalPhasesCount: p.phases.length,
    phases: p.phases.map((ph) => ({
      id: ph.id,
      code: ph.code,
      name: ph.name,
      isCompleted: ph.isCompleted,
      ownerId: ph.ownerId || undefined,
    })),
    description: p.description || undefined,
    tags: p.tags,
    createdAt: p.createdAt.toISOString().split("T")[0],
  };
}

const PROJECT_INCLUDE = {
  owner: {
    select: { id: true, name: true, email: true, image: true, department: true },
  },
  phases: {
    orderBy: { order: "asc" as const },
  },
  tasks: { select: { status: true } },
};

export async function getProjectsAction(): Promise<Project[]> {
  const session = await requireAuth();

  const isPrivileged = await isPrivilegedViewer(session.user.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let whereCondition: any = {};
  if (!isPrivileged) {
    const user = await db.user.findUnique({ where: { id: session.user.id } });
    const userName = user?.name || session.user.name || "";

    whereCondition = {
      OR: [
        { ownerId: session.user.id },
        { createdByUserId: session.user.id },
        ...(userName ? [{ ownerName: userName }] : []),
        { members: { some: { userId: session.user.id } } },
        {
          tasks: {
            some: {
              OR: [
                { ownerId: session.user.id },
                { authorId: session.user.id },
                ...(userName
                  ? [
                      { owner: userName },
                      { owners: { has: userName } },
                    ]
                  : []),
              ],
            },
          },
        },
      ],
    };
  }

  const dbProjects = await db.project.findMany({
    where: whereCondition,
    include: PROJECT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return dbProjects.map(toProject);
}

export async function getProjectByIdAction(projectId: string): Promise<Project | null> {
  const session = await requireAuth();

  const isPrivileged = await isPrivilegedViewer(session.user.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let extraWhere: any = {};
  if (!isPrivileged) {
    const user = await db.user.findUnique({ where: { id: session.user.id } });
    const userName = user?.name || session.user.name || "";

    extraWhere = {
      OR: [
        { ownerId: session.user.id },
        { createdByUserId: session.user.id },
        ...(userName ? [{ ownerName: userName }] : []),
        { members: { some: { userId: session.user.id } } },
        {
          tasks: {
            some: {
              OR: [
                { ownerId: session.user.id },
                { authorId: session.user.id },
                ...(userName
                  ? [
                      { owner: userName },
                      { owners: { has: userName } },
                    ]
                  : []),
              ],
            },
          },
        },
      ],
    };
  }

  const p = await db.project.findFirst({
    where: {
      AND: [
        { OR: [{ id: projectId }, { code: projectId }] },
        extraWhere,
      ],
    },
    include: PROJECT_INCLUDE,
  });

  if (!p) return null;

  return toProject(p);
}

async function nextProjectCode(): Promise<string> {
  const rows = await db.project.findMany({ select: { code: true } });
  let max = 0;
  for (const row of rows) {
    const match = row.code?.match(/^EEDP-(\d+)$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `EEDP-${max + 1}`;
}

function incrementProjectCode(code: string): string {
  const match = code.match(/^EEDP-(\d+)$/);
  const n = match ? parseInt(match[1], 10) : 0;
  return `EEDP-${n + 1}`;
}

export async function createProjectAction(data: NewProjectFormData): Promise<Project> {
  const session = await requireAuth();

  let ownerUser = null;
  if (data.owner) {
    ownerUser = await db.user.findFirst({
      where: {
        OR: [{ id: data.owner }, { name: data.owner }, { email: data.owner }],
      },
    });
  }
  if (!ownerUser) {
    ownerUser = await db.user.findUnique({ where: { id: session.user.id } });
  }

  const ownerName = ownerUser?.name || session.user.name || "Project Owner";
  const initials = ownerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  let nextCode = await nextProjectCode();
  let newProject: Awaited<ReturnType<typeof db.project.create>> | undefined;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      newProject = await db.project.create({
        data: {
          code: nextCode,
          name: data.name,
          projectCategory: data.projectCategory || "CLIENT_DELIVERY",
          departmentAlias: "digitalproducts@",
          templateUsed: data.templateUsed || undefined,
          isClientVisible: data.isClientVisible ?? true,
          group: data.group || undefined,
          businessHours: data.businessHours || "Standard Business Hours",
          taskLayout: data.taskLayout || "New Project Template",
          ownerId: ownerUser?.id || session.user.id,
          createdByUserId: session.user.id,
          ownerName: ownerName,
          ownerInitials: initials,
          ownerAvatarColor: "bg-primary text-primary-foreground",
          status: "ACTIVE",
          totalHours: "00:00 h",
          billableHours: "00:00 h",
          nonBillableHours: "00:00 h",
          startDate: data.startDate || new Date().toISOString().split("T")[0],
          deadline: data.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          description: data.description || "",
          associatedTeam: data.associatedTeam || "",
          priority: data.priority || "None",
          tags: typeof data.tags === "string" ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
          reminder: data.reminder || "",
          billingType: data.billingType || "Fixed Rate",
        },
      });
      break;
    } catch (err: unknown) {
      // P2002 = unique constraint violation on `code` (a concurrent create won the race).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code === "P2002") {
        nextCode = incrementProjectCode(nextCode);
        continue;
      }
      throw err;
    }
  }

  if (!newProject) {
    throw new Error("Failed to create project: could not generate a unique project code.");
  }

  // Create ProjectMember entries for owner and creator
  const memberUserIds = Array.from(
    new Set([session.user.id, ownerUser?.id].filter(Boolean) as string[])
  );
  if (memberUserIds.length > 0) {
    await db.projectMember.createMany({
      data: memberUserIds.map((userId) => ({
        projectId: newProject.id,
        userId,
      })),
      skipDuplicates: true,
    });
  }

  // Scaffold real ProjectPhase/ProjectTaskList/ProjectTask rows from the selected template
  // (previously this data was computed client-side and silently discarded).
  let createdPhaseCount = 0;
  let createdTaskCount = 0;
  const template = data.templateId
    ? DEFAULT_PROJECT_TEMPLATES.find((t) => t.id === data.templateId)
    : undefined;

  if (template) {
    const scaffoldedPhases = scaffoldPhasesFromTemplate(template);
    const scaffoldedTaskLists = scaffoldTaskListsFromTemplate(template);
    const scaffoldedTasks = scaffoldTasksFromTemplate(
      template,
      newProject.code || newProject.id,
      ownerName,
      ownerUser?.id || session.user.id
    );

    if (scaffoldedPhases.length > 0) {
      const phaseOwnerId = ownerUser?.id || session.user.id;
      await db.projectPhase.createMany({
        data: scaffoldedPhases.map((ph, idx) => ({
          code: ph.code,
          name: ph.name,
          isCompleted: false,
          order: idx,
          ownerId: phaseOwnerId,
          projectId: newProject.id,
        })),
      });
      createdPhaseCount = scaffoldedPhases.length;
    }

    if (scaffoldedTaskLists.length > 0) {
      await db.projectTaskList.createMany({
        data: scaffoldedTaskLists.map((tl) => ({
          name: tl.name,
          flag: tl.flag,
          status: tl.status,
          sequence: tl.sequence,
          phaseCode: tl.phaseCode,
          projectId: newProject.id,
        })),
      });
    }

    if (scaffoldedTasks.length > 0) {
      const taskOwnerId = ownerUser?.id || session.user.id;
      await db.projectTask.createMany({
        data: scaffoldedTasks.map((t) => ({
          code: t.code || `${newProject.code || newProject.id}-T01`,
          title: t.title || "Untitled Task",
          phaseCode: t.phaseCode,
          phaseName: t.phaseName,
          taskListName: t.taskListName,
          isExternal: t.isExternal ?? true,
          status: "Open",
          authorId: session.user.id,
          authorName: session.user.name || "System",
          departmentAlias: t.departmentAlias,
          duration: t.duration,
          priority: t.priority,
          description: t.description,
          ownerId: taskOwnerId,
          owner: ownerName,
          owners: [ownerName],
          ownerIds: [taskOwnerId],
          projectId: newProject.id,
        })),
      });
      createdTaskCount = scaffoldedTasks.length;
    }
  }

  if (data.notifyAddedUsers && ownerUser) {
    await db.notification.create({
      data: {
        type: "PROJECT_ASSIGNED",
        title: "New project assigned",
        message: `You were assigned as owner of "${newProject.name}".`,
        userId: ownerUser.id,
        createdById: session.user.id,
        relatedEntryId: newProject.id,
      },
    });
  }

  revalidatePath("/projects");

  return {
    id: newProject.code || newProject.id,
    name: newProject.name,
    progressPercent: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    projectCategory: (newProject.projectCategory as any) || "CLIENT_DELIVERY",
    departmentAlias: newProject.departmentAlias || "digitalproducts@",
    templateUsed: newProject.templateUsed || undefined,
    isClientVisible: newProject.isClientVisible,
    group: newProject.group || undefined,
    businessHours: newProject.businessHours || undefined,
    taskLayout: newProject.taskLayout || undefined,
    owner: {
      id: ownerUser?.id || session.user.id,
      name: ownerName,
      initials: initials,
      avatarColor: "bg-primary text-primary-foreground",
    },
    status: "ACTIVE",
    totalHours: "00:00 h",
    billableHours: "00:00 h",
    nonBillableHours: "00:00 h",
    startDate: newProject.startDate || "",
    deadline: newProject.deadline || "",
    completedTasksCount: 0,
    totalTasksCount: createdTaskCount,
    taskProgressPercent: 0,
    completedPhasesCount: 0,
    totalPhasesCount: createdPhaseCount,
    phases: [],
    createdAt: newProject.createdAt.toISOString().split("T")[0],
  };
}

export async function deleteProjectAction(projectId: string): Promise<boolean> {
  await requireAuth();

  await db.project.deleteMany({
    where: {
      OR: [{ id: projectId }, { code: projectId }],
    },
  });

  revalidatePath("/projects");
  return true;
}

/**
 * ----------------------------------------------------
 * TASKS CRUD & MY TASKS ACTIONS
 * ----------------------------------------------------
 */

export async function getTasksAction(projectId?: string): Promise<TaskItem[]> {
  await requireAuth();

  const whereCondition = projectId
    ? {
        OR: [
          { projectId },
          { project: { code: projectId } },
        ],
      }
    : {};

  const dbTasks = await db.projectTask.findMany({
    where: whereCondition,
    include: {
      ownerUser: {
        select: { id: true, name: true, email: true, image: true },
      },
      author: {
        select: { id: true, name: true, email: true },
      },
      childTasks: {
        include: { ownerUser: { select: { name: true } } },
        orderBy: { createdAt: "asc" as const },
      },
      remarks: true,
      activities: true,
      ...TASK_OWNERS_INCLUDE,
    },
    orderBy: { createdAt: "desc" },
  });

  return dbTasks.map((t) => {
    const ownersDisplay = resolveOwnersDisplay(t.owners, t.ownerUser?.name, t.owner, t.ownerId);
    return {
    id: t.code || t.id,
    code: t.code || t.id,
    title: t.title,
    phaseCode: t.phaseCode || "1.1",
    phaseName: t.phaseName || "CLIENT ONBOARDING",
    taskListId: t.taskListId || undefined,
    taskListName: t.taskListName || undefined,
    isExternal: t.isExternal,
    status: (t.status as TaskStatus) || "Open",
    authorName: t.author?.name || t.authorName || "System",
    authorId: t.authorId || undefined,
    associatedTeam: t.associatedTeam || undefined,
    departmentAlias: t.departmentAlias || "digitalproducts@",
    owner: t.ownerUser?.name || t.owner || "Unassigned",
    ownerId: t.ownerId || undefined,
    owners: ownersDisplay.owners,
    ownerIds: ownersDisplay.ownerIds,
    workHours: t.workHours || "00:00",
    startDate: t.startDate || "--",
    dueDate: t.dueDate || "--",
    duration: t.duration || "1 day",
    completionPercentage: t.completionPercentage,
    recurrence: t.recurrence || "None",
    priority: (t.priority as ProjectPriority) || "None",
    tags: t.tags || [],
    reminder: t.reminder || "None",
    billingType: (t.billingType as BillingType) || "None",
    description: t.description || "",
    isWarning: t.isWarning,
    staleAlert: t.staleAlert,
    hasAttachments: t.hasAttachments,
    hasComments: t.hasComments,
    hasReminder: t.hasReminder,
    hasRecurrence: t.hasRecurrence,
    parentTaskId: t.parentTaskId || undefined,
    subtasks: t.childTasks.map((ct) => ({
      id: ct.code || ct.id,
      code: ct.code || ct.id,
      title: ct.title,
      status: (ct.status as TaskStatus) || "Open",
      ownerName: ct.ownerUser?.name || ct.owner || "Unassigned",
      startDate: ct.startDate || "--",
      dueDate: ct.dueDate || "--",
      completed: ct.status === "Closed" || ct.completionPercentage >= 100,
      hasLink: false,
    })),
    remarks: t.remarks.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      authorInitials: r.authorInitials,
      authorAvatarColor: r.authorAvatarColor || undefined,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
    })),
    activities: t.activities.map((act) => ({
      id: act.id,
      date: act.createdAt.toISOString().split("T")[0],
      time: act.createdAt.toISOString().split("T")[1]?.substring(0, 5) || "00:00",
      userName: act.userName,
      userInitials: act.userInitials,
      actionText: act.actionText,
    })),
    };
  });
}

export async function getProjectTasksAction(projectId?: string): Promise<TaskItem[]> {
  await requireAuth();

  const whereClause = projectId
    ? { OR: [{ projectId }, { project: { code: projectId } }] }
    : {};

  const dbTasks = await db.projectTask.findMany({
    where: whereClause,
    include: {
      ownerUser: { select: { id: true, name: true, email: true, image: true } },
      author: { select: { id: true, name: true, email: true } },
      childTasks: {
        include: { ownerUser: { select: { name: true } } },
        orderBy: { createdAt: "asc" as const },
      },
      remarks: true,
      activities: true,
      ...TASK_OWNERS_INCLUDE,
    },
    orderBy: { createdAt: "desc" },
  });

  return dbTasks.map((t) => {
    const ownersDisplay = resolveOwnersDisplay(t.owners, t.ownerUser?.name, t.owner, t.ownerId);
    return {
    id: t.code || t.id,
    code: t.code || t.id,
    title: t.title,
    phaseCode: t.phaseCode || "1.1",
    phaseName: t.phaseName || "CLIENT ONBOARDING",
    taskListId: t.taskListId || undefined,
    taskListName: t.taskListName || undefined,
    isExternal: t.isExternal,
    status: (t.status as TaskStatus) || "Open",
    authorName: t.author?.name || t.authorName || "System",
    authorId: t.authorId || undefined,
    associatedTeam: t.associatedTeam || undefined,
    departmentAlias: t.departmentAlias || "digitalproducts@",
    owner: t.ownerUser?.name || t.owner || "Unassigned",
    ownerId: t.ownerId || undefined,
    owners: ownersDisplay.owners,
    ownerIds: ownersDisplay.ownerIds,
    workHours: t.workHours || "00:00",
    startDate: t.startDate || "--",
    dueDate: t.dueDate || "--",
    duration: t.duration || "1 day",
    completionPercentage: t.completionPercentage,
    recurrence: t.recurrence || "None",
    priority: (t.priority as ProjectPriority) || "None",
    tags: t.tags || [],
    reminder: t.reminder || "None",
    billingType: (t.billingType as BillingType) || "None",
    description: t.description || "",
    isWarning: t.isWarning,
    staleAlert: t.staleAlert,
    hasAttachments: t.hasAttachments,
    hasComments: t.hasComments,
    hasReminder: t.hasReminder,
    hasRecurrence: t.hasRecurrence,
    parentTaskId: t.parentTaskId || undefined,
    subtasks: t.childTasks.map((ct) => ({
      id: ct.code || ct.id,
      code: ct.code || ct.id,
      title: ct.title,
      status: (ct.status as TaskStatus) || "Open",
      ownerName: ct.ownerUser?.name || ct.owner || "Unassigned",
      startDate: ct.startDate || "--",
      dueDate: ct.dueDate || "--",
      completed: ct.status === "Closed" || ct.completionPercentage >= 100,
      hasLink: false,
    })),
    remarks: t.remarks.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      authorInitials: r.authorInitials,
      authorAvatarColor: r.authorAvatarColor || undefined,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
    })),
    activities: t.activities.map((act) => ({
      id: act.id,
      date: act.createdAt.toISOString().split("T")[0],
      time: act.createdAt.toISOString().split("T")[1]?.substring(0, 5) || "00:00",
      userName: act.userName,
      userInitials: act.userInitials,
      actionText: act.actionText,
    })),
    };
  });
}

export async function getMyTasksAction(): Promise<TaskItem[]> {
  const session = await requireAuth();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true },
  });

  const userName = (user?.name || session.user.name || "").trim();
  const userId = session.user.id;
  const uNameLower = userName.toLowerCase();

  // "Assigned to Me" means ProjectTaskOwner contains a row for this user — pushed straight into
  // the query via the relation, not JS-side name matching. `ownerId = userId` and the legacy
  // exact-name match are OR'd in only to still surface rows that predate the join table (created
  // before every task was migrated to it); a co-owner who isn't the *primary* owner still
  // matches via `owners: { some: { userId } }`, so this can never miss a secondary owner.
  const myDbTasks = await db.projectTask.findMany({
    where: {
      OR: [
        { owners: { some: { userId } } },
        { ownerId: userId },
        ...(uNameLower ? [{ owner: { equals: userName, mode: "insensitive" as const } }] : []),
      ],
    },
    include: {
      ownerUser: {
        select: { id: true, name: true, email: true, image: true },
      },
      author: {
        select: { id: true, name: true, email: true },
      },
      childTasks: {
        include: { ownerUser: { select: { name: true } } },
        orderBy: { createdAt: "asc" as const },
      },
      remarks: true,
      activities: true,
      ...TASK_OWNERS_INCLUDE,
    },
    orderBy: { createdAt: "desc" },
  });

  return myDbTasks.map((t) => {
    const ownersDisplay = resolveOwnersDisplay(t.owners, t.ownerUser?.name, t.owner, t.ownerId);
    return {
    id: t.code || t.id,
    code: t.code || t.id,
    title: t.title,
    phaseCode: t.phaseCode || "1.1",
    phaseName: t.phaseName || "CLIENT ONBOARDING",
    taskListId: t.taskListId || undefined,
    taskListName: t.taskListName || undefined,
    isExternal: t.isExternal,
    status: (t.status as TaskStatus) || "Open",
    authorName: t.author?.name || t.authorName || "System",
    authorId: t.authorId || undefined,
    associatedTeam: t.associatedTeam || undefined,
    departmentAlias: t.departmentAlias || "digitalproducts@",
    owner: t.ownerUser?.name || t.owner || "Unassigned",
    ownerId: t.ownerId || undefined,
    owners: ownersDisplay.owners,
    ownerIds: ownersDisplay.ownerIds,
    workHours: t.workHours || "00:00",
    startDate: t.startDate || "--",
    dueDate: t.dueDate || "--",
    duration: t.duration || "1 day",
    completionPercentage: t.completionPercentage,
    recurrence: t.recurrence || "None",
    priority: (t.priority as ProjectPriority) || "None",
    tags: t.tags || [],
    reminder: t.reminder || "None",
    billingType: (t.billingType as BillingType) || "None",
    description: t.description || "",
    isWarning: t.isWarning,
    staleAlert: t.staleAlert,
    hasAttachments: t.hasAttachments,
    hasComments: t.hasComments,
    hasReminder: t.hasReminder,
    hasRecurrence: t.hasRecurrence,
    parentTaskId: t.parentTaskId || undefined,
    subtasks: t.childTasks.map((ct) => ({
      id: ct.code || ct.id,
      code: ct.code || ct.id,
      title: ct.title,
      status: (ct.status as TaskStatus) || "Open",
      ownerName: ct.ownerUser?.name || ct.owner || "Unassigned",
      startDate: ct.startDate || "--",
      dueDate: ct.dueDate || "--",
      completed: ct.status === "Closed" || ct.completionPercentage >= 100,
      hasLink: false,
    })),
    remarks: t.remarks.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      authorInitials: r.authorInitials,
      authorAvatarColor: r.authorAvatarColor || undefined,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
    })),
    activities: t.activities.map((act) => ({
      id: act.id,
      date: act.createdAt.toISOString().split("T")[0],
      time: act.createdAt.toISOString().split("T")[1]?.substring(0, 5) || "00:00",
      userName: act.userName,
      userInitials: act.userInitials,
      actionText: act.actionText,
    })),
    };
  });
}

export async function getMyTaskCountAction(projectId?: string): Promise<number> {
  const tasks = await getMyTasksAction();
  if (projectId) {
    return tasks.filter((t) => t.id === projectId || t.code?.includes(projectId)).length;
  }
  return tasks.length;
}

export async function createTaskAction(
  taskData: Partial<TaskItem>,
  projectId?: string
): Promise<TaskItem> {
  const session = await requireAuth();

  let resolvedProject: { id: string; code: string | null; ownerId: string | null; ownerName: string | null } | null = null;
  if (projectId) {
    resolvedProject = await db.project.findFirst({
      where: { OR: [{ id: projectId }, { code: projectId }] },
      select: { id: true, code: true, ownerId: true, ownerName: true },
    });
  }

  const codePrefix = resolvedProject?.code || projectId || "TASK";
  const count = resolvedProject
    ? await db.projectTask.count({ where: { projectId: resolvedProject.id } })
    : await db.projectTask.count();
  const nextCode = `${codePrefix}-T${count + 1}`;

  const ownerNamesInput =
    taskData.owners && taskData.owners.length > 0
      ? taskData.owners
      : taskData.owner && taskData.owner !== "Unassigned"
      ? [taskData.owner]
      : resolvedProject?.ownerName
      ? [resolvedProject.ownerName]
      : [];

  const resolvedOwners = ownerNamesInput.length
    ? await db.user.findMany({
        where: {
          OR: ownerNamesInput.flatMap((o) => [{ id: o }, { name: o }, { email: o }]),
        },
      })
    : [];

  const ownerNames = Array.from(
    new Set(
      ownerNamesInput.map((raw) => {
        const match = resolvedOwners.find(
          (u) => u.id === raw || u.name === raw || u.email === raw
        );
        return match?.name || raw;
      })
    )
  );
  const ownerIdsResolved = Array.from(
    new Set(
      ownerNamesInput
        .map(
          (raw) =>
            resolvedOwners.find((u) => u.id === raw || u.name === raw || u.email === raw)?.id
        )
        .filter((id): id is string => Boolean(id))
    )
  );
  const primaryOwner = resolvedOwners[0];

  const defaultOwnerId = primaryOwner?.id || resolvedProject?.ownerId || undefined;

  const createdTask = await db.projectTask.create({
    data: {
      code: nextCode,
      title: taskData.title || "New Task",
      phaseCode: taskData.phaseCode || "1.1",
      phaseName: taskData.phaseName || "CLIENT ONBOARDING",
      taskListId: taskData.taskListId || undefined,
      taskListName: taskData.taskListName || undefined,
      isExternal: taskData.isExternal ?? true,
      status: taskData.status || "Open",
      authorId: session.user.id,
      authorName: session.user.name || "User",
      associatedTeam: taskData.associatedTeam || "Engineering",
      departmentAlias: taskData.departmentAlias || "digitalproducts@",
      projectId: resolvedProject?.id || undefined,
      ownerId: defaultOwnerId,
      owner: ownerNames.length > 0 ? ownerNames.join(", ") : resolvedProject?.ownerName || "Unassigned",
      workHours: taskData.workHours || "00:00",
      startDate: taskData.startDate || "--",
      dueDate: taskData.dueDate || "--",
      duration: taskData.duration || "1 day",
      completionPercentage: taskData.completionPercentage || 0,
      priority: taskData.priority || "None",
      tags: taskData.tags || [],
      description: taskData.description || "",
    },
  });

  const finalOwnerIds =
    ownerIdsResolved.length > 0 ? ownerIdsResolved : defaultOwnerId ? [defaultOwnerId] : [];
  if (finalOwnerIds.length > 0) {
    await db.projectTaskOwner.createMany({
      data: finalOwnerIds.map((userId) => ({
        taskId: createdTask.id,
        userId,
        assignedById: session.user.id,
      })),
      skipDuplicates: true,
    });
  }

  const creatorName = session.user.name || "User";
  await db.projectTaskActivity.create({
    data: {
      userName: creatorName,
      userId: session.user.id,
      userInitials: toInitials(creatorName),
      actionText: "created this task",
      taskId: createdTask.id,
    },
  });

  revalidatePath("/projects");

  return {
    id: createdTask.code || createdTask.id,
    code: createdTask.code || createdTask.id,
    title: createdTask.title,
    phaseCode: createdTask.phaseCode || "1.1",
    phaseName: createdTask.phaseName || "CLIENT ONBOARDING",
    taskListId: createdTask.taskListId || undefined,
    taskListName: createdTask.taskListName || undefined,
    isExternal: createdTask.isExternal,
    status: (createdTask.status as TaskStatus) || "Open",
    authorName: createdTask.authorName || "User",
    associatedTeam: createdTask.associatedTeam || undefined,
    departmentAlias: createdTask.departmentAlias || "digitalproducts@",
    owner: createdTask.owner || "Unassigned",
    owners: ownerNames,
    ownerIds: finalOwnerIds,
    workHours: createdTask.workHours || "00:00",
    startDate: createdTask.startDate || "--",
    dueDate: createdTask.dueDate || "--",
    duration: createdTask.duration || "1 day",
    completionPercentage: createdTask.completionPercentage,
    recurrence: "None",
    priority: (createdTask.priority as ProjectPriority) || "None",
    tags: createdTask.tags || [],
    reminder: "None",
    billingType: "None",
    description: createdTask.description || "",
    isWarning: false,
    staleAlert: false,
    hasAttachments: false,
    hasComments: false,
    hasReminder: false,
    hasRecurrence: false,
    subtasks: [],
    remarks: [],
    activities: [],
  };
}

export type UpdateTaskResult = { success: boolean; error?: string };

export async function updateTaskAction(
  taskId: string,
  updates: Partial<TaskItem>
): Promise<UpdateTaskResult> {
  const session = await requireAuth();

  const task = await db.projectTask.findFirst({
    where: { OR: [{ id: taskId }, { code: taskId }] },
    include: { project: { select: { ownerId: true } }, ...TASK_OWNERS_INCLUDE },
  });
  if (!task) {
    return { success: false, error: "Task not found." };
  }

  // Editable by: the task's own owner(s) — checked against ProjectTaskOwner, the real source of
  // truth, with legacy ownerId/owner-name fallbacks only for rows that predate it — the owner of
  // the project the task belongs to (a project owner has full control over every task inside
  // their project, not just ones they personally own), or — for a task with no owner yet —
  // whoever authored/created it, so it isn't permanently locked before anyone claims ownership.
  const actorNameLower = (session.user.name || "").trim().toLowerCase();
  const ownerIdsOnTask = task.owners.map((o) => o.userId);
  const ownerNamesOnTask = (
    task.owners.length > 0
      ? task.owners.map((o) => o.user.name || o.user.email)
      : task.owner && task.owner !== "Unassigned"
      ? [task.owner]
      : []
  ).map((o) => o.trim().toLowerCase());
  const hasOwnerRows = task.owners.length > 0;
  const isTaskOwnerCheck = hasOwnerRows
    ? ownerIdsOnTask.includes(session.user.id)
    : (Boolean(task.ownerId) && task.ownerId === session.user.id) ||
      (Boolean(actorNameLower) && ownerNamesOnTask.includes(actorNameLower));
  const isProjectOwner = Boolean(task.project?.ownerId) && task.project?.ownerId === session.user.id;
  const isUnownedAuthor =
    !hasOwnerRows &&
    !task.ownerId &&
    ownerNamesOnTask.length === 0 &&
    task.authorId === session.user.id;
  if (!isTaskOwnerCheck && !isProjectOwner && !isUnownedAuthor) {
    return { success: false, error: "You do not have permission to edit this task." };
  }

  let ownerNames: string[] = [];
  let ownerIdsResolved: string[] = [];
  let primaryOwnerId: string | null = null;
  if (updates.owners !== undefined) {
    const namesInput = updates.owners;
    const resolvedOwners = namesInput.length
      ? await db.user.findMany({
          where: {
            OR: namesInput.flatMap((o) => [{ id: o }, { name: o }, { email: o }]),
          },
        })
      : [];
    ownerNames = namesInput.map((raw) => {
      const match = resolvedOwners.find(
        (u) => u.id === raw || u.name === raw || u.email === raw
      );
      return match?.name || raw;
    });
    ownerIdsResolved = Array.from(
      new Set(
        namesInput
          .map(
            (raw) =>
              resolvedOwners.find((u) => u.id === raw || u.name === raw || u.email === raw)?.id
          )
          .filter((id): id is string => Boolean(id))
      )
    );
    ownerNames = Array.from(new Set(ownerNames));
    primaryOwnerId = resolvedOwners[0]?.id ?? null;
  } else if (updates.owner) {
    const ownerUser = await db.user.findFirst({
      where: {
        OR: [{ id: updates.owner }, { name: updates.owner }, { email: updates.owner }],
      },
    });
    primaryOwnerId = ownerUser?.id ?? null;
    ownerIdsResolved = ownerUser ? [ownerUser.id] : [];
  }

  const newOwnerDisplay =
    updates.owners !== undefined
      ? ownerNames.length > 0
        ? ownerNames.join(", ")
        : "Unassigned"
      : updates.owner;
  const ownerIsChanging =
    (updates.owners !== undefined || updates.owner !== undefined) &&
    newOwnerDisplay !== undefined &&
    newOwnerDisplay !== (task.owner || "Unassigned");

  // Diff against the current row to build a human-readable activity trail — old value,
  // new value, who changed it, and when (createdAt), without inventing a parallel data model.
  const actorName = session.user.name || "User";
  const initials = toInitials(actorName);
  const activityEntries: string[] = [];

  if (updates.title && updates.title !== task.title) {
    activityEntries.push(`changed the title from "${task.title}" to "${updates.title}"`);
  }
  if (updates.status && updates.status !== task.status) {
    activityEntries.push(`changed status from "${task.status}" to "${updates.status}"`);
  }
  if (updates.priority && updates.priority !== task.priority) {
    activityEntries.push(
      `changed priority from "${task.priority || "None"}" to "${updates.priority}"`
    );
  }
  if (updates.dueDate !== undefined && updates.dueDate !== task.dueDate) {
    activityEntries.push(
      `changed due date from "${task.dueDate || "--"}" to "${updates.dueDate || "--"}"`
    );
  }
  if (updates.startDate !== undefined && updates.startDate !== task.startDate) {
    activityEntries.push(
      `changed start date from "${task.startDate || "--"}" to "${updates.startDate || "--"}"`
    );
  }
  if (updates.description !== undefined && updates.description !== task.description) {
    activityEntries.push("updated the description");
  }
  if (ownerIsChanging) {
    activityEntries.push(
      `changed task owner from "${task.owner || "Unassigned"}" to "${newOwnerDisplay}"`
    );
  }

  await db.projectTask.updateMany({
    where: {
      OR: [{ id: taskId }, { code: taskId }],
    },
    data: {
      ...(updates.title && { title: updates.title }),
      ...(updates.status && { status: updates.status }),
      ...(updates.priority && { priority: updates.priority }),
      ...(updates.startDate !== undefined && { startDate: updates.startDate }),
      ...(updates.dueDate !== undefined && { dueDate: updates.dueDate }),
      ...(updates.owners !== undefined && {
        owner: ownerNames.length > 0 ? ownerNames.join(", ") : "Unassigned",
        ownerId: primaryOwnerId,
      }),
      ...(updates.owners === undefined &&
        updates.owner && {
          owner: updates.owner,
          ownerId: primaryOwnerId,
        }),
      ...(updates.completionPercentage !== undefined && {
        completionPercentage: updates.completionPercentage,
      }),
      ...(updates.description !== undefined && { description: updates.description }),
      lastActivityDate: new Date(),
    },
  });

  // Sync the real owner set in the join table. When the caller sent the full desired `owners`
  // list, replace the set exactly (adds/removes only what changed, preserving assignedAt/
  // assignedBy for owners who stay). When only a single legacy `owner` string was sent, that
  // person is *added* as an owner without touching anyone else — a single-owner update must
  // never silently wipe existing co-owners.
  if (updates.owners !== undefined) {
    await syncTaskOwners(task.id, ownerIdsResolved, session.user.id);
  } else if (updates.owner !== undefined && primaryOwnerId) {
    await db.projectTaskOwner.createMany({
      data: [{ taskId: task.id, userId: primaryOwnerId, assignedById: session.user.id }],
      skipDuplicates: true,
    });
  }

  if (activityEntries.length > 0) {
    await db.projectTaskActivity.createMany({
      data: activityEntries.map((actionText) => ({
        userName: actorName,
        userId: session.user.id,
        userInitials: initials,
        actionText,
        taskId: task.id,
      })),
    });
  }

  revalidatePath("/projects");
  return { success: true };
}

export async function deleteTaskAction(taskId: string): Promise<boolean> {
  await requireAuth();

  await db.projectTask.deleteMany({
    where: {
      OR: [{ id: taskId }, { code: taskId }],
    },
  });

  revalidatePath("/projects");
  return true;
}

async function resolveTaskDbId(taskId: string): Promise<string | null> {
  const task = await db.projectTask.findFirst({
    where: { OR: [{ id: taskId }, { code: taskId }] },
    select: { id: true },
  });
  return task?.id ?? null;
}

// Subtasks are real ProjectTask rows with a `parentTaskId` — this gives them the exact same
// detail page, timer (with owner gating), description, comments, and time logs as any normal
// task, instead of the old lightweight ProjectSubtask model which had none of that.
export async function createSubtaskAction(
  taskId: string,
  subtaskData: Partial<TaskSubtask>
): Promise<TaskSubtask | null> {
  const session = await requireAuth();

  const parentTask = await db.projectTask.findFirst({
    where: { OR: [{ id: taskId }, { code: taskId }] },
    select: {
      id: true,
      code: true,
      projectId: true,
      phaseCode: true,
      phaseName: true,
      project: { select: { ownerId: true, ownerName: true } },
    },
  });
  if (!parentTask) return null;

  const count = await db.projectTask.count({ where: { parentTaskId: parentTask.id } });
  const ownerName = subtaskData.ownerName && subtaskData.ownerName !== "Unassigned" ? subtaskData.ownerName : undefined;
  let ownerUser = null;
  if (ownerName) {
    ownerUser = await db.user.findFirst({
      where: { OR: [{ id: ownerName }, { name: ownerName }, { email: ownerName }] },
    });
  }
  // No owner explicitly chosen — default to the project owner, same rule as top-level tasks.
  const finalOwnerId = ownerUser?.id || (!ownerName ? parentTask.project?.ownerId : undefined);
  const finalOwnerName = ownerUser?.name || ownerName || (!ownerName ? parentTask.project?.ownerName : undefined) || "Unassigned";

  const created = await db.projectTask.create({
    data: {
      code: `${parentTask.code || taskId}.${count + 1}`,
      title: subtaskData.title || "New Subtask",
      status: subtaskData.status || "Open",
      completionPercentage: subtaskData.completed ? 100 : 0,
      ownerId: finalOwnerId || undefined,
      owner: finalOwnerName,
      startDate: subtaskData.startDate || "--",
      dueDate: subtaskData.dueDate || "--",
      phaseCode: parentTask.phaseCode || "1.1",
      phaseName: parentTask.phaseName || "General",
      projectId: parentTask.projectId,
      parentTaskId: parentTask.id,
    },
  });

  if (finalOwnerId) {
    await db.projectTaskOwner.createMany({
      data: [{ taskId: created.id, userId: finalOwnerId, assignedById: session.user.id }],
      skipDuplicates: true,
    });
  }

  revalidatePath("/projects");

  return {
    id: created.code || created.id,
    code: created.code || created.id,
    title: created.title,
    status: created.status as TaskStatus,
    ownerName: created.owner || "Unassigned",
    startDate: created.startDate || "--",
    dueDate: created.dueDate || "--",
    completed: created.completionPercentage >= 100,
    hasLink: false,
  };
}

export async function updateSubtaskAction(
  subtaskId: string,
  updates: Partial<TaskSubtask>
): Promise<boolean> {
  const session = await requireAuth();

  let ownerUserId: string | undefined;
  if (updates.ownerName) {
    const ownerUser = await db.user.findFirst({
      where: { OR: [{ id: updates.ownerName }, { name: updates.ownerName }, { email: updates.ownerName }] },
    });
    ownerUserId = ownerUser?.id;
  }

  const subtask = await db.projectTask.findFirst({
    where: { OR: [{ id: subtaskId }, { code: subtaskId }] },
    select: { id: true },
  });

  await db.projectTask.updateMany({
    where: { OR: [{ id: subtaskId }, { code: subtaskId }] },
    data: {
      ...(updates.title && { title: updates.title }),
      ...(updates.status && { status: updates.status }),
      ...(updates.completed !== undefined && {
        completionPercentage: updates.completed ? 100 : 0,
      }),
      ...(updates.ownerName && {
        owner: updates.ownerName,
        ownerId: ownerUserId,
      }),
    },
  });

  if (updates.ownerName && ownerUserId && subtask) {
    await syncTaskOwners(subtask.id, [ownerUserId], session.user.id);
  }

  revalidatePath("/projects");
  return true;
}

export async function deleteSubtaskAction(subtaskId: string): Promise<boolean> {
  await requireAuth();

  await db.projectTask.deleteMany({
    where: { OR: [{ id: subtaskId }, { code: subtaskId }] },
  });

  revalidatePath("/projects");
  return true;
}

export async function createTaskRemarkAction(
  taskId: string,
  content: string
): Promise<TaskRemark | null> {
  const session = await requireAuth();

  const dbTaskId = await resolveTaskDbId(taskId);
  if (!dbTaskId) return null;

  const authorName = session.user.name || "User";
  const initials = authorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const created = await db.projectTaskRemark.create({
    data: {
      authorName,
      authorInitials: initials,
      content,
      taskId: dbTaskId,
    },
  });

  revalidatePath("/projects");

  return {
    id: created.id,
    authorName: created.authorName,
    authorInitials: created.authorInitials,
    authorAvatarColor: created.authorAvatarColor || undefined,
    content: created.content,
    createdAt: created.createdAt.toISOString(),
  };
}

/**
 * ----------------------------------------------------
 * REAL USER MANAGEMENT & INVITES ACTIONS
 * ----------------------------------------------------
 */

function toInitials(name: string): string {
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "U"
  );
}

function toProjectUser(u: {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  profileRole: string | null;
  department: string | null;
  title: string | null;
  isActive: boolean;
  projectMemberships: { project: { id: string; name: string } }[];
}): ProjectUser {
  const name = u.name || u.email.split("@")[0];
  const profileRole = (u.profileRole as ProfileRoleValue) || "EMPLOYEE";
  const roleTier = deriveMemberRoleTier(u.role, profileRole);

  return {
    id: u.id,
    name,
    email: u.email,
    userType: profileRole === "CLIENT" ? "CLIENT" : "PORTAL",
    initials: toInitials(name),
    avatarColor: "bg-primary text-primary-foreground",
    role: roleTier,
    profileRole,
    department: (u.department as UserDepartment) || "Development",
    departmentAlias: "digitalproducts@",
    title: u.title || "Team Member",
    portalProfile: PROFILE_ROLE_LABELS[profileRole],
    projects: u.projectMemberships.map((m) => m.project.name).join(", ") || undefined,
    statusText: u.isActive ? "Active" : "Invited",
  };
}

export async function getUsersAction(): Promise<ProjectUser[]> {
  await requireAuth();

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      profileRole: true,
      department: true,
      title: true,
      isActive: true,
      createdAt: true,
      projectMemberships: {
        select: { project: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return users.map(toProjectUser);
}

export async function inviteUserAction(
  email: string,
  name: string,
  role: MemberRoleTier = "TEAM_MEMBER",
  department: string = "Development",
  profileRole?: ProfileRoleValue,
  projectIds: string[] = []
): Promise<ProjectUser> {
  await requireAuth();

  // The underlying Prisma `User.role` enum only has TEAM_MEMBER|MANAGER (used site-wide for
  // manager route gating). "Administrator" is represented as MANAGER + profileRole ADMIN.
  const dbRole = role === "TEAM_MEMBER" ? "TEAM_MEMBER" : "MANAGER";
  const resolvedProfileRole: ProfileRoleValue =
    profileRole ?? (role === "ADMIN" ? "ADMIN" : "EMPLOYEE");

  const upsertedUser = await db.user.upsert({
    where: { email },
    update: {
      name,
      department,
      role: dbRole,
      profileRole: resolvedProfileRole,
      title: role === "MANAGER" ? "Project Manager" : role === "ADMIN" ? "Administrator" : "Team Member",
    },
    create: {
      email,
      name,
      department,
      role: dbRole,
      profileRole: resolvedProfileRole,
      title: role === "MANAGER" ? "Project Manager" : role === "ADMIN" ? "Administrator" : "Team Member",
      isActive: true,
    },
  });

  if (projectIds.length > 0) {
    await db.projectMember.createMany({
      data: projectIds.map((projectId) => ({ projectId, userId: upsertedUser.id })),
      skipDuplicates: true,
    });
  }

  const memberships = await db.projectMember.findMany({
    where: { userId: upsertedUser.id },
    select: { project: { select: { id: true, name: true } } },
  });

  revalidatePath("/projects/users");

  return toProjectUser({ ...upsertedUser, projectMemberships: memberships });
}

export async function updateUserRoleAction(
  userId: string,
  role: MemberRoleTier,
  profileRole: ProfileRoleValue
): Promise<ProjectUser> {
  await requireAuth();

  const dbRole = role === "TEAM_MEMBER" ? "TEAM_MEMBER" : "MANAGER";

  const updatedUser = await db.user.update({
    where: { id: userId },
    data: { role: dbRole, profileRole },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      profileRole: true,
      department: true,
      title: true,
      isActive: true,
      projectMemberships: {
        select: { project: { select: { id: true, name: true } } },
      },
    },
  });

  revalidatePath("/projects/users");

  return toProjectUser(updatedUser);
}

export interface ProjectMemberUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: string;
  profileRole?: string | null;
  title?: string | null;
  department?: string | null;
  assignedAt?: string;
  isOwner?: boolean;
}

export async function getProjectMembersAction(projectId: string): Promise<ProjectMemberUser[]> {
  await requireAuth();

  const project = await db.project.findFirst({
    where: { OR: [{ id: projectId }, { code: projectId }] },
    select: { id: true, ownerId: true },
  });

  if (!project) return [];

  const members = await db.projectMember.findMany({
    where: { projectId: project.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          profileRole: true,
          title: true,
          department: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const memberUsers: ProjectMemberUser[] = members.map((m) => ({
    id: m.user.id,
    name: m.user.name || m.user.email.split("@")[0],
    email: m.user.email,
    image: m.user.image,
    role: String(m.user.role),
    profileRole: m.user.profileRole,
    title: m.user.title || "Team Member",
    department: m.user.department || "Development",
    assignedAt: m.createdAt.toISOString().split("T")[0],
    isOwner: m.user.id === project.ownerId,
  }));

  // If project has an owner specified but no members record yet, include owner
  if (project.ownerId && !memberUsers.some((u) => u.id === project.ownerId)) {
    const owner = await db.user.findUnique({
      where: { id: project.ownerId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        profileRole: true,
        title: true,
        department: true,
      },
    });
    if (owner) {
      memberUsers.unshift({
        id: owner.id,
        name: owner.name || owner.email.split("@")[0],
        email: owner.email,
        image: owner.image,
        role: String(owner.role),
        profileRole: owner.profileRole,
        title: owner.title || "Project Owner",
        department: owner.department || "Management",
        isOwner: true,
      });
    }
  }

  return memberUsers;
}

export async function getAvailableUsersForProjectAction(projectId: string): Promise<ProjectMemberUser[]> {
  await requireAuth();

  const project = await db.project.findFirst({
    where: { OR: [{ id: projectId }, { code: projectId }] },
    select: { id: true },
  });

  const targetProjectId = project?.id || projectId;

  // Get currently assigned user IDs
  const assigned = await db.projectMember.findMany({
    where: { projectId: targetProjectId },
    select: { userId: true },
  });
  const assignedUserIds = new Set(assigned.map((a) => a.userId));

  // Get all active users in system not in assignedUserIds
  const users = await db.user.findMany({
    where: {
      isActive: true,
      id: { notIn: Array.from(assignedUserIds) },
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      profileRole: true,
      title: true,
      department: true,
    },
    orderBy: { name: "asc" },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name || u.email.split("@")[0],
    email: u.email,
    image: u.image,
    role: String(u.role),
    profileRole: u.profileRole,
    title: u.title || "Team Member",
    department: u.department || "Development",
  }));
}

export async function addProjectMembersAction(
  projectId: string,
  userIds: string[]
): Promise<boolean> {
  await requireAuth();
  if (!userIds || userIds.length === 0) return true;

  const project = await db.project.findFirst({
    where: { OR: [{ id: projectId }, { code: projectId }] },
    select: { id: true },
  });
  const targetProjectId = project?.id || projectId;

  await db.projectMember.createMany({
    data: userIds.map((userId) => ({
      projectId: targetProjectId,
      userId,
    })),
    skipDuplicates: true,
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return true;
}

export async function removeProjectMemberAction(
  projectId: string,
  userId: string
): Promise<boolean> {
  await requireAuth();

  const project = await db.project.findFirst({
    where: { OR: [{ id: projectId }, { code: projectId }] },
    select: { id: true },
  });
  const targetProjectId = project?.id || projectId;

  await db.projectMember.deleteMany({
    where: {
      projectId: targetProjectId,
      userId: userId,
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return true;
}

export async function getOwnersAndTeamsAction(projectId?: string): Promise<{
  owners: { id: string; name: string; email: string; department?: string | null }[];
  teams: string[];
}> {
  await requireAuth();

  let targetUsers: { id: string; name: string | null; email: string; department: string | null }[] = [];

  if (projectId) {
    const project = await db.project.findFirst({
      where: { OR: [{ id: projectId }, { code: projectId }] },
      select: { id: true, ownerId: true },
    });

    if (project) {
      const members = await db.projectMember.findMany({
        where: { projectId: project.id },
        include: {
          user: {
            select: { id: true, name: true, email: true, department: true },
          },
        },
      });

      targetUsers = members.map((m) => m.user);

      if (project.ownerId && !targetUsers.some((u) => u.id === project.ownerId)) {
        const owner = await db.user.findUnique({
          where: { id: project.ownerId },
          select: { id: true, name: true, email: true, department: true },
        });
        if (owner) targetUsers.unshift(owner);
      }
    }
  }

  if (targetUsers.length === 0) {
    targetUsers = await db.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
      },
      orderBy: { name: "asc" },
    });
  }

  const owners = targetUsers.map((u) => ({
    id: u.id,
    name: u.name || u.email.split("@")[0],
    email: u.email,
    department: u.department,
  }));

  const allUsersForTeams = await db.user.findMany({
    where: { isActive: true },
    select: { department: true },
  });

  const defaultTeams = [
    "Engineering",
    "UI/UX Design",
    "Marketing",
    "QA & Testing",
    "Product Management",
    "SEO & Content",
  ];
  const dbDepartments = Array.from(
    new Set(allUsersForTeams.map((u) => u.department).filter(Boolean) as string[])
  );
  const teams = Array.from(new Set([...defaultTeams, ...dbDepartments]));

  return { owners, teams };
}

/**
 * ----------------------------------------------------
 * TIME LOGS ACTIONS
 * ----------------------------------------------------
 */

/** Extracts "H:MM" (any digit width) from a free-text duration like "00:08" or "01:00 h". */
function parseDurationMinutes(duration: string): number {
  const match = duration.match(/(\d+):(\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function getTimeLogsAction(projectId?: string): Promise<UserTimeGroup[]> {
  const session = await requireAuth();
  const canViewAll = await isPrivilegedViewer(session.user.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let projectFilter: any = {};
  if (projectId) {
    const project = await db.project.findFirst({
      where: { OR: [{ id: projectId }, { code: projectId }] },
      select: { id: true, code: true, name: true },
    });

    const searchTokens = Array.from(
      new Set([projectId, project?.id, project?.code, project?.name].filter(Boolean))
    ) as string[];

    projectFilter = {
      OR: [
        { projectId: { in: searchTokens } },
        { project: { in: searchTokens } },
        { taskCode: { contains: projectId } },
      ],
    };
  }

  // Team members only ever see their own time logs; managers/admins see everyone's.
  const ownershipFilter = canViewAll
    ? {}
    : {
        OR: [
          { userId: session.user.id },
          { userId: null, userName: session.user.name },
        ],
      };

  const dbLogs = await db.projectTimeLog.findMany({
    where: { AND: [projectFilter, ownershipFilter] },
    orderBy: { createdAt: "desc" },
  });

  const userMap = new Map<string, UserTimeGroup>();

  dbLogs.forEach((log) => {
    const userName = log.userName || session.user.name || "User";
    const initials = userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    if (!userMap.has(userName)) {
      userMap.set(userName, {
        userId: log.id,
        userName: userName,
        userInitials: initials,
        avatarColor: log.avatarColor || "bg-primary text-primary-foreground",
        dailyLogHours: "00:00 | 00:00 | 00:00",
        timeLogs: [],
      });
    }

    const group = userMap.get(userName)!;
    group.timeLogs.push({
      id: log.id,
      code: log.code,
      title: log.title,
      project: log.project,
      projectId: log.projectId || undefined,
      taskCode: log.taskCode || undefined,
      duration: log.duration,
      timePeriod: log.timePeriod,
      date: log.date,
      billingType: log.billingType as "NON BILLABLE" | "BILLABLE",
      remarks: log.remarks || "",
      approvalStatus: (log.approvalStatus as "Pending" | "Approved" | "Rejected") || "Pending",
      userName: userName,
      userInitials: initials,
      userId: log.userId || undefined,
      createdAt: log.createdAt.toISOString(),
    });
  });

  // Real per-user "Total | Billable | Non-billable" summary, derived from their actual logs.
  for (const group of userMap.values()) {
    let billableMinutes = 0;
    let nonBillableMinutes = 0;
    for (const log of group.timeLogs) {
      const minutes = parseDurationMinutes(log.duration);
      if (log.billingType === "BILLABLE") billableMinutes += minutes;
      else nonBillableMinutes += minutes;
    }
    group.dailyLogHours = `${formatMinutes(billableMinutes + nonBillableMinutes)} | ${formatMinutes(billableMinutes)} | ${formatMinutes(nonBillableMinutes)}`;
  }

  return Array.from(userMap.values());
}

export async function createTimeLogAction(
  logData: Partial<TimeLogEntry>,
  projectId?: string
): Promise<TimeLogEntry> {
  const session = await requireAuth();

  const count = await db.projectTimeLog.count();
  const nextCode = `EEDP-89-TL${count + 1}`;

  let userName = logData.userName;
  if (!userName || userName === "User") {
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });
    userName = dbUser?.name || session.user.name || session.user.email || "System User";
  }

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  let resolvedProjectId: string | undefined;
  let resolvedProjectName: string = logData.project || "EagleEye DP Portal";

  const projectKey = projectId || logData.projectId || (logData.taskCode ? logData.taskCode.split("-").slice(0, 2).join("-") : undefined);
  if (projectKey) {
    const project = await db.project.findFirst({
      where: { OR: [{ id: projectKey }, { code: projectKey }] },
      select: { id: true, name: true },
    });
    if (project) {
      resolvedProjectId = project.id;
      resolvedProjectName = project.name;
    }
  }

  const newLog = await db.projectTimeLog.create({
    data: {
      code: nextCode,
      title: logData.title || "Logged Work",
      project: resolvedProjectName,
      projectId: resolvedProjectId,
      taskCode: logData.taskCode || undefined,
      duration: logData.duration || "01:00 h",
      timePeriod: logData.timePeriod || "10:00 AM - 11:00 AM",
      date: logData.date || new Date().toISOString().split("T")[0],
      billingType: logData.billingType || "NON BILLABLE",
      remarks: logData.remarks || "",
      approvalStatus: logData.approvalStatus || "Pending",
      userName: userName,
      userInitials: initials,
      avatarColor: "bg-primary text-primary-foreground",
      userId: session.user.id,
    },
  });

  revalidatePath("/projects/time-tracker");

  return {
    id: newLog.id,
    code: newLog.code,
    title: newLog.title,
    project: newLog.project,
    projectId: newLog.projectId || undefined,
    taskCode: newLog.taskCode || undefined,
    duration: newLog.duration,
    timePeriod: newLog.timePeriod,
    date: newLog.date,
    billingType: newLog.billingType as "NON BILLABLE" | "BILLABLE",
    remarks: newLog.remarks || "",
    approvalStatus: newLog.approvalStatus as "Pending" | "Approved" | "Rejected",
    userName: userName,
    userInitials: initials,
    userId: session.user.id,
    createdAt: newLog.createdAt.toISOString(),
  };
}

export async function updateTimeLogAction(
  logId: string,
  updates: Partial<TimeLogEntry>
): Promise<boolean> {
  await requireAuth();

  await db.projectTimeLog.updateMany({
    where: {
      OR: [{ id: logId }, { code: logId }],
    },
    data: {
      ...(updates.title && { title: updates.title }),
      ...(updates.project && { project: updates.project }),
      ...(updates.taskCode !== undefined && { taskCode: updates.taskCode }),
      ...(updates.duration && { duration: updates.duration }),
      ...(updates.timePeriod && { timePeriod: updates.timePeriod }),
      ...(updates.date && { date: updates.date }),
      ...(updates.billingType && { billingType: updates.billingType }),
      ...(updates.remarks !== undefined && { remarks: updates.remarks }),
      ...(updates.approvalStatus && { approvalStatus: updates.approvalStatus }),
    },
  });

  revalidatePath("/projects/time-tracker");
  return true;
}

export async function deleteTimeLogAction(logId: string): Promise<boolean> {
  await requireAuth();

  await db.projectTimeLog.deleteMany({
    where: {
      OR: [{ id: logId }, { code: logId }],
    },
  });

  revalidatePath("/projects/time-tracker");
  return true;
}

export async function approveTimeLogsAction(logIds: string[]): Promise<boolean> {
  await requireAuth();
  if (!logIds || logIds.length === 0) return true;

  await db.projectTimeLog.updateMany({
    where: {
      id: { in: logIds },
    },
    data: {
      approvalStatus: "Approved",
    },
  });

  revalidatePath("/projects/time-tracker");
  return true;
}

export async function rejectTimeLogsAction(
  logIds: string[],
  reason?: string
): Promise<boolean> {
  await requireAuth();
  if (!logIds || logIds.length === 0) return true;

  await db.projectTimeLog.updateMany({
    where: {
      id: { in: logIds },
    },
    data: {
      approvalStatus: "Rejected",
      ...(reason ? { remarks: `Rejected: ${reason}` } : {}),
    },
  });

  revalidatePath("/projects/time-tracker");
  return true;
}

export async function getTaskTimeLogsAction(taskCode: string): Promise<TimeLogEntry[]> {
  const session = await requireAuth();
  const canViewAll = await isPrivilegedViewer(session.user.id);

  const ownershipFilter = canViewAll
    ? {}
    : {
        OR: [
          { userId: session.user.id },
          { userId: null, userName: session.user.name },
        ],
      };

  const logs = await db.projectTimeLog.findMany({
    where: { taskCode, ...ownershipFilter },
    orderBy: { createdAt: "desc" },
  });

  return logs.map((log) => ({
    id: log.id,
    code: log.code,
    title: log.title,
    project: log.project,
    taskCode: log.taskCode || undefined,
    duration: log.duration,
    timePeriod: log.timePeriod,
    date: log.date,
    billingType: log.billingType as "NON BILLABLE" | "BILLABLE",
    remarks: log.remarks || "",
    approvalStatus: log.approvalStatus as "Pending" | "Approved" | "Rejected",
  }));
}

export async function getCurrentUserRoleAction(): Promise<WorkspaceRole> {
  const session = await auth();
  if (!session?.user?.id) {
    return "TEAM_MEMBER";
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, profileRole: true },
  });

  if (!user || !user.role) {
    return "TEAM_MEMBER";
  }

  const roleStr = String(user.role).toUpperCase();
  if (
    roleStr === "ADMIN" ||
    roleStr === "SUPER_ADMIN" ||
    roleStr === "PROJECT_MANAGER" ||
    roleStr === "MANAGER" ||
    user.profileRole === "ADMIN"
  ) {
    return "ADMIN";
  }

  return "TEAM_MEMBER";
}

export async function getCurrentUserContextAction(): Promise<{
  id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  const canViewAll = await isPrivilegedViewer(session.user.id);

  return {
    id: session.user.id,
    name: dbUser?.name || session.user.name || session.user.email || "System User",
    email: dbUser?.email || session.user.email || "",
    role: canViewAll ? "ADMIN" : "TEAM_MEMBER",
  };
}
