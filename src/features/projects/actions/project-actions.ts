"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  Project,
  TaskItem,
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
  phases: { id: string; code: string; name: string; isCompleted: boolean }[];
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
  await requireAuth();

  const dbProjects = await db.project.findMany({
    include: PROJECT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return dbProjects.map(toProject);
}

export async function getProjectByIdAction(projectId: string): Promise<Project | null> {
  await requireAuth();

  const p = await db.project.findFirst({
    where: {
      OR: [{ id: projectId }, { code: projectId }],
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
    const scaffoldedTasks = scaffoldTasksFromTemplate(template, newProject.code || newProject.id);

    if (scaffoldedPhases.length > 0) {
      await db.projectPhase.createMany({
        data: scaffoldedPhases.map((ph, idx) => ({
          code: ph.code,
          name: ph.name,
          isCompleted: false,
          order: idx,
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
      await db.projectTask.createMany({
        data: scaffoldedTasks.map((t) => ({
          code: t.code,
          title: t.title,
          phaseCode: t.phaseCode,
          phaseName: t.phaseName,
          taskListName: t.taskListName,
          isExternal: t.isExternal ?? true,
          status: "Open",
          authorName: t.authorName,
          departmentAlias: t.departmentAlias,
          duration: t.duration,
          priority: t.priority,
          description: t.description,
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
      subtasks: true,
      remarks: true,
      activities: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return dbTasks.map((t) => ({
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
    associatedTeam: t.associatedTeam || undefined,
    departmentAlias: t.departmentAlias || "digitalproducts@",
    owner: t.ownerUser?.name || t.owner || "Unassigned",
    owners: t.ownerUser?.name ? [t.ownerUser.name] : t.owner ? [t.owner] : [],
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
    subtasks: t.subtasks.map((st) => ({
      id: st.id,
      code: st.code,
      title: st.title,
      status: (st.status as TaskStatus) || "Open",
      ownerName: st.ownerName || "Unassigned",
      startDate: st.startDate || "--",
      dueDate: st.dueDate || "--",
      completed: st.completed,
      hasLink: st.hasLink,
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
  }));
}

export async function getMyTasksAction(): Promise<TaskItem[]> {
  const session = await requireAuth();

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  const userName = user?.name || session.user.name || "";

  const dbTasks = await db.projectTask.findMany({
    where: {
      OR: [
        { ownerId: session.user.id },
        { owner: userName },
        { authorId: session.user.id },
      ],
    },
    include: {
      ownerUser: true,
      subtasks: true,
      remarks: true,
      activities: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return dbTasks.map((t) => ({
    id: t.code || t.id,
    code: t.code || t.id,
    title: t.title,
    phaseCode: t.phaseCode || "1.1",
    phaseName: t.phaseName || "CLIENT ONBOARDING",
    taskListId: t.taskListId || undefined,
    taskListName: t.taskListName || undefined,
    isExternal: t.isExternal,
    status: (t.status as TaskStatus) || "Open",
    authorName: t.authorName || "System",
    associatedTeam: t.associatedTeam || undefined,
    departmentAlias: t.departmentAlias || "digitalproducts@",
    owner: t.ownerUser?.name || t.owner || "Unassigned",
    owners: t.ownerUser?.name ? [t.ownerUser.name] : t.owner ? [t.owner] : [],
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
    subtasks: t.subtasks.map((st) => ({
      id: st.id,
      code: st.code,
      title: st.title,
      status: (st.status as TaskStatus) || "Open",
      ownerName: st.ownerName || "Unassigned",
      startDate: st.startDate || "--",
      dueDate: st.dueDate || "--",
      completed: st.completed,
      hasLink: st.hasLink,
    })),
    remarks: [],
    activities: [],
  }));
}

export async function getMyTaskCountAction(projectId?: string): Promise<number> {
  const session = await requireAuth();

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  const userName = user?.name || session.user.name || "";

  return db.projectTask.count({
    where: {
      AND: [
        {
          OR: [
            { ownerId: session.user.id },
            { owner: userName },
            { authorId: session.user.id },
          ],
        },
        projectId
          ? { OR: [{ projectId }, { project: { code: projectId } }] }
          : {},
      ],
    },
  });
}

export async function createTaskAction(taskData: Partial<TaskItem>): Promise<TaskItem> {
  const session = await requireAuth();

  const count = await db.projectTask.count();
  const nextCode = `EEDP-89-T${count + 1}`;

  let ownerUser = null;
  if (taskData.owner) {
    ownerUser = await db.user.findFirst({
      where: {
        OR: [{ id: taskData.owner }, { name: taskData.owner }, { email: taskData.owner }],
      },
    });
  }

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
      ownerId: ownerUser?.id || undefined,
      owner: ownerUser?.name || taskData.owner || "Unassigned",
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
    owners: ownerUser?.name ? [ownerUser.name] : [],
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

export async function updateTaskAction(
  taskId: string,
  updates: Partial<TaskItem>
): Promise<boolean> {
  await requireAuth();

  let ownerUserId: string | undefined = undefined;
  if (updates.owner) {
    const ownerUser = await db.user.findFirst({
      where: {
        OR: [{ id: updates.owner }, { name: updates.owner }, { email: updates.owner }],
      },
    });
    if (ownerUser) ownerUserId = ownerUser.id;
  }

  await db.projectTask.updateMany({
    where: {
      OR: [{ id: taskId }, { code: taskId }],
    },
    data: {
      ...(updates.title && { title: updates.title }),
      ...(updates.status && { status: updates.status }),
      ...(updates.priority && { priority: updates.priority }),
      ...(updates.owner && { owner: updates.owner, ownerId: ownerUserId }),
      ...(updates.completionPercentage !== undefined && {
        completionPercentage: updates.completionPercentage,
      }),
      ...(updates.description && { description: updates.description }),
      lastActivityDate: new Date(),
    },
  });

  revalidatePath("/projects");
  return true;
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

export async function getOwnersAndTeamsAction(): Promise<{
  owners: { id: string; name: string; email: string; department?: string | null }[];
  teams: string[];
}> {
  await requireAuth();

  const users = await db.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
    },
    orderBy: { name: "asc" },
  });

  const owners = users.map((u) => ({
    id: u.id,
    name: u.name || u.email.split("@")[0],
    email: u.email,
    department: u.department,
  }));

  const defaultTeams = [
    "Engineering",
    "UI/UX Design",
    "Marketing",
    "QA & Testing",
    "Product Management",
    "SEO & Content",
  ];
  const dbDepartments = Array.from(
    new Set(users.map((u) => u.department).filter(Boolean) as string[])
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

  let resolvedProjectId: string | undefined;
  if (projectId) {
    const project = await db.project.findFirst({
      where: { OR: [{ id: projectId }, { code: projectId }] },
      select: { id: true },
    });
    resolvedProjectId = project?.id;
  }

  const dbLogs = await db.projectTimeLog.findMany({
    where: resolvedProjectId ? { projectId: resolvedProjectId } : {},
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
      duration: log.duration,
      timePeriod: log.timePeriod,
      date: log.date,
      billingType: log.billingType as "NON BILLABLE" | "BILLABLE",
      remarks: log.remarks || "",
      approvalStatus: (log.approvalStatus as "Pending" | "Approved" | "Rejected") || "Pending",
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

  const userName = session.user.name || "User";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  let resolvedProjectId: string | undefined;
  if (projectId) {
    const project = await db.project.findFirst({
      where: { OR: [{ id: projectId }, { code: projectId }] },
      select: { id: true },
    });
    resolvedProjectId = project?.id;
  }

  const newLog = await db.projectTimeLog.create({
    data: {
      code: nextCode,
      title: logData.title || "Logged Work",
      project: logData.project || "EagleEye DP Portal",
      projectId: resolvedProjectId,
      duration: logData.duration || "01:00 h",
      timePeriod: logData.timePeriod || "10:00 AM - 11:00 AM",
      date: logData.date || new Date().toISOString().split("T")[0],
      billingType: logData.billingType || "NON BILLABLE",
      remarks: logData.remarks || "",
      approvalStatus: logData.approvalStatus || "Pending",
      userName: userName,
      userInitials: initials,
      avatarColor: "bg-primary text-primary-foreground",
    },
  });

  revalidatePath("/projects/time-tracker");

  return {
    id: newLog.id,
    code: newLog.code,
    title: newLog.title,
    project: newLog.project,
    duration: newLog.duration,
    timePeriod: newLog.timePeriod,
    date: newLog.date,
    billingType: newLog.billingType as "NON BILLABLE" | "BILLABLE",
    remarks: newLog.remarks || "",
    approvalStatus: newLog.approvalStatus as "Pending" | "Approved" | "Rejected",
  };
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
