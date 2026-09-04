/* eslint-disable @typescript-eslint/no-explicit-any */
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
  ProjectDocument,
  ProjectTimelineEvent,
  ProjectTemplate,
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
async function isPrivilegedViewer(userId: string, projectId?: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, profileRole: true },
  });
  if (user && user.role) {
    const roleStr = String(user.role).toUpperCase();
    if (
      roleStr === "ADMIN" ||
      roleStr === "SUPER_ADMIN" ||
      roleStr === "PROJECT_MANAGER" ||
      roleStr === "MANAGER" ||
      user.profileRole === "ADMIN"
    ) {
      return true;
    }
  }

  if (projectId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = db as any;
    const project = await d.project.findFirst({
      where: { OR: [{ id: projectId }, { code: projectId }] },
      select: { ownerId: true },
    });
    if (project && project.ownerId === userId) {
      return true;
    }
  }

  return false;
}

/**
 * Looks up a project template by id from the DB (managers can edit templates there — see
 * template-actions.ts), falling back to the built-in static templates if the DB row doesn't
 * exist yet (e.g. before the lazy seed in getProjectTemplatesAction has ever run).
 */
async function findProjectTemplate(templateId: string): Promise<ProjectTemplate | undefined> {
  const row = await (db as any).projectTemplate.findUnique({ where: { id: templateId } });
  if (row) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      isDefault: row.isDefault,
      phases: row.phases,
    };
  }
  return DEFAULT_PROJECT_TEMPLATES.find((t) => t.id === templateId);
}

async function findDefaultProjectTemplate(): Promise<ProjectTemplate> {
  const row = await (db as any).projectTemplate.findFirst({
    where: { isDefault: true },
    orderBy: { createdAt: "asc" },
  });
  if (row) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      isDefault: row.isDefault,
      phases: row.phases,
    };
  }
  return DEFAULT_PROJECT_TEMPLATES[0];
}

async function isClientUser(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, profileRole: true },
  });
  if (!user) return false;
  const pRole = String(user.profileRole || "").toUpperCase();
  const role = String(user.role || "").toUpperCase();
  return pRole === "CLIENT" || role === "CLIENT";
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

function isUserId(str: string | null | undefined): boolean {
  if (!str) return false;
  const s = str.trim();
  return (
    /^c[a-z0-9]{20,}$/i.test(s) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ||
    (s.startsWith("u-") && s.length > 5)
  );
}

async function getUserMap(): Promise<Map<string, string>> {
  try {
    const users = await db.user.findMany({ select: { id: true, name: true, email: true } });
    const map = new Map<string, string>();
    for (const u of users) {
      const displayName = u.name || u.email || u.id;
      map.set(u.id, displayName);
      if (u.email) map.set(u.email.toLowerCase(), displayName);
    }
    return map;
  } catch (e) {
    console.error("Failed to fetch user map:", e);
    return new Map();
  }
}

/** Builds the `{ owners, ownerIds }` pair the client-facing TaskItem shape expects, from the
 *  join table first, falling back to legacy single-owner fields only for rows with no join rows. */
function resolveOwnersDisplay(
  relOwners: TaskOwnerRow[] | undefined,
  legacyOwnerUserName: string | null | undefined,
  legacyOwner: string | null | undefined,
  legacyOwnerId: string | null | undefined,
  userMap?: Map<string, string>
): { owners: string[]; ownerIds: string[] } {
  if (relOwners && relOwners.length > 0) {
    const names = relOwners
      .map((o) => {
        const n = o.user.name || o.user.email;
        if (n && !isUserId(n)) return n;
        return userMap?.get(o.userId) || o.userId;
      })
      .filter((n) => !isUserId(n));

    if (names.length > 0) {
      return {
        owners: names,
        ownerIds: relOwners.map((o) => o.userId),
      };
    }
  }

  if (legacyOwnerUserName && !isUserId(legacyOwnerUserName)) {
    return { owners: [legacyOwnerUserName], ownerIds: legacyOwnerId ? [legacyOwnerId] : [] };
  }

  if (legacyOwnerId && userMap?.has(legacyOwnerId)) {
    const resolvedName = userMap.get(legacyOwnerId)!;
    if (!isUserId(resolvedName)) {
      return { owners: [resolvedName], ownerIds: [legacyOwnerId] };
    }
  }

  if (legacyOwner && legacyOwner !== "Unassigned") {
    const list = legacyOwner
      .split(",")
      .map((s) => {
        const raw = s.trim();
        if (!isUserId(raw)) return raw;
        return userMap?.get(raw) || undefined;
      })
      .filter((n): n is string => Boolean(n) && !isUserId(n));

    if (list.length > 0) {
      return { owners: list, ownerIds: legacyOwnerId ? [legacyOwnerId] : [] };
    }
  }

  return { owners: [], ownerIds: legacyOwnerId ? [legacyOwnerId] : [] };
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

function toProject(
  p: {
    id: string;
    code: string | null;
    name: string;
    progressPercent: number;
    projectCategory: string | null;
    departmentAlias: string | null;
    templateUsed: string | null;
    accessType?: string | null;
    isClientVisible: boolean;
    group: string | null;
    businessHours: string | null;
    taskLayout: string | null;
    ownerId: string | null;
    ownerName: string | null;
    ownerAvatarColor: string | null;
    owner: { id: string; name: string | null; email?: string | null } | null;
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
  },
  userMap?: Map<string, string>
): Project {
  const completedPhases = p.phases.filter((ph) => ph.isCompleted).length;
  const completedTasks = p.tasks.filter(
    (t) => t.status === "Closed" || t.status === "CLOSED"
  ).length;
  const totalTasks = p.tasks.length;

  let resolvedOwnerName: string | undefined = p.owner?.name && !isUserId(p.owner.name) ? p.owner.name : undefined;
  if (!resolvedOwnerName) {
    resolvedOwnerName = p.owner?.email && !isUserId(p.owner.email) ? p.owner.email : undefined;
  }
  if (!resolvedOwnerName) {
    resolvedOwnerName = p.ownerName && !isUserId(p.ownerName) ? p.ownerName : undefined;
  }
  if (!resolvedOwnerName && p.ownerId && userMap?.has(p.ownerId)) {
    const mapped = userMap.get(p.ownerId);
    if (mapped && !isUserId(mapped)) {
      resolvedOwnerName = mapped;
    }
  }
  if (!resolvedOwnerName) {
    resolvedOwnerName = "Unassigned";
  }

  const initials = resolvedOwnerName
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
    accessType: (p.accessType as "PUBLIC" | "PRIVATE") || "PUBLIC",
    isClientVisible: p.isClientVisible,
    group: p.group || undefined,
    businessHours: p.businessHours || undefined,
    taskLayout: p.taskLayout || undefined,
    owner: {
      id: p.owner?.id || p.ownerId || "u-default",
      name: resolvedOwnerName,
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
  const userMap = await getUserMap();

  const isPrivileged = await isPrivilegedViewer(session.user.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let whereCondition: any = {};
  if (!isPrivileged) {
    const user = await db.user.findUnique({ where: { id: session.user.id } });
    const userName = user?.name || session.user.name || "";

    whereCondition = {
      OR: [
        { accessType: "PUBLIC" },
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
                      { owners: { some: { userId: session.user.id } } },
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

  return dbProjects.map((p) => toProject(p, userMap));
}

/**
 * Projects where the current user has an explicit `ProjectMember` row — narrower than
 * `getProjectsAction`, which also surfaces public/owned/task-involvement projects. Backs the
 * "My Dashboard" view.
 */
export async function getMyProjectsAction(): Promise<Project[]> {
  const session = await requireAuth();
  const userMap = await getUserMap();

  const dbProjects = await db.project.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: PROJECT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return dbProjects.map((p) => toProject(p, userMap));
}

export type MyProjectCalendarItem = {
  id: string;
  projectId: string;
  projectName: string;
  taskTitle: string;
  dueDate: Date;
};

/**
 * Derives a lightweight calendar feed from task due dates on the current user's member projects.
 * No dedicated calendar/event model backs this — `ProjectTask.dueDate` is a free-form string
 * (often the literal placeholder "--"), so unparsable values are dropped rather than surfaced.
 */
export async function getMyProjectCalendarEventsAction(): Promise<MyProjectCalendarItem[]> {
  const session = await requireAuth();

  const dbProjects = await db.project.findMany({
    where: { members: { some: { userId: session.user.id } } },
    select: {
      id: true,
      name: true,
      tasks: { select: { id: true, title: true, dueDate: true } },
    },
  });

  const items: MyProjectCalendarItem[] = [];
  for (const project of dbProjects) {
    for (const task of project.tasks) {
      if (!task.dueDate || task.dueDate === "--") continue;
      const parsed = new Date(task.dueDate);
      if (isNaN(parsed.getTime())) continue;
      items.push({
        id: task.id,
        projectId: project.id,
        projectName: project.name,
        taskTitle: task.title,
        dueDate: parsed,
      });
    }
  }

  return items;
}

export async function getProjectByIdAction(projectId: string): Promise<Project | null> {
  const session = await requireAuth();
  const userMap = await getUserMap();

  const isPrivileged = await isPrivilegedViewer(session.user.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let extraWhere: any = {};
  if (!isPrivileged) {
    const user = await db.user.findUnique({ where: { id: session.user.id } });
    const userName = user?.name || session.user.name || "";

    extraWhere = {
      OR: [
        { accessType: "PUBLIC" },
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
                      { owners: { some: { userId: session.user.id } } },
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

  return toProject(p, userMap);
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
  if (!(await isPrivilegedViewer(session.user.id))) {
    throw new Error("Only a manager can create a new project.");
  }

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
          accessType: data.accessType || "PUBLIC",
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
  const template = data.templateId ? await findProjectTemplate(data.templateId) : undefined;

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
      const createdDbPhases = await db.projectPhase.findMany({
        where: { projectId: newProject.id },
        select: { id: true, code: true },
      });
      const phaseIdMap = new Map(createdDbPhases.map((p) => [p.code, p.id]));

      await db.projectTask.createMany({
        data: scaffoldedTasks.map((t) => ({
          code: t.code || `${newProject.code || newProject.id}-T01`,
          title: t.title || "Untitled Task",
          phaseId: t.phaseCode ? phaseIdMap.get(t.phaseCode) : undefined,
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
          projectId: newProject.id,
        })),
      });
      createdTaskCount = scaffoldedTasks.length;

      // Fix 2: Ensure every scaffolded task has a ProjectTaskOwner row so they
      // appear in My Tasks for the project owner from the moment the project is created.
      const scaffoldedDbTasks = await db.projectTask.findMany({
        where: { projectId: newProject.id },
        select: { id: true },
      });
      if (taskOwnerId && scaffoldedDbTasks.length > 0) {
        await db.projectTaskOwner.createMany({
          data: scaffoldedDbTasks.map((t) => ({
            taskId: t.id,
            userId: taskOwnerId,
            assignedById: session.user.id,
          })),
          skipDuplicates: true,
        });
      }
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
  const userMap = await getUserMap();

  const whereCondition = projectId
    ? {
        OR: [
          { projectId },
          { project: { code: projectId } },
          { project: { id: projectId } },
        ],
      }
    : {};

  const dbTasks = await db.projectTask.findMany({
    where: whereCondition,
    include: {
      phase: {
        select: { id: true, code: true, name: true },
      },
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
      subtasks: {
        orderBy: { createdAt: "asc" as const },
      },
      remarks: true,
      activities: true,
      ...TASK_OWNERS_INCLUDE,
    },
    orderBy: { createdAt: "desc" },
  });

  if (projectId && dbTasks.length === 0) {
    const project = await db.project.findFirst({
      where: { OR: [{ id: projectId }, { code: projectId }] },
      select: { id: true, code: true, ownerName: true, ownerId: true },
    });

    if (project) {
      const template = await findDefaultProjectTemplate();
      const scaffoldedPhases = scaffoldPhasesFromTemplate(template);
      const scaffoldedTasks = scaffoldTasksFromTemplate(
        template,
        project.code || project.id,
        project.ownerName || "Project Owner",
        project.ownerId || undefined
      );

      let createdDbPhases = await db.projectPhase.findMany({
        where: { projectId: project.id },
        select: { id: true, code: true },
      });

      if (createdDbPhases.length === 0 && scaffoldedPhases.length > 0) {
        await db.projectPhase.createMany({
          data: scaffoldedPhases.map((ph, idx) => ({
            code: ph.code,
            name: ph.name,
            isCompleted: false,
            order: idx,
            ownerId: project.ownerId,
            projectId: project.id,
          })),
        });
        createdDbPhases = await db.projectPhase.findMany({
          where: { projectId: project.id },
          select: { id: true, code: true },
        });
      }

      const phaseIdMap = new Map(createdDbPhases.map((p) => [p.code, p.id]));
      const taskOwnerId = project.ownerId;

      if (scaffoldedTasks.length > 0) {
        await db.projectTask.createMany({
          data: scaffoldedTasks.map((t) => ({
            code: t.code || `${project.code || project.id}-T01`,
            title: t.title || "Untitled Task",
            phaseId: t.phaseCode ? phaseIdMap.get(t.phaseCode) : undefined,
            phaseCode: t.phaseCode,
            phaseName: t.phaseName,
            taskListName: t.taskListName,
            isExternal: t.isExternal ?? true,
            status: "Open",
            authorId: taskOwnerId,
            authorName: project.ownerName || "System",
            departmentAlias: t.departmentAlias,
            duration: t.duration,
            priority: t.priority,
            description: t.description,
            ownerId: taskOwnerId,
            owner: project.ownerName || "Unassigned",
            projectId: project.id,
          })),
        });

        if (taskOwnerId) {
          const createdTasks = await db.projectTask.findMany({
            where: { projectId: project.id },
            select: { id: true },
          });
          if (createdTasks.length > 0) {
            await db.projectTaskOwner.createMany({
              data: createdTasks.map((t) => ({
                taskId: t.id,
                userId: taskOwnerId,
                assignedById: taskOwnerId,
              })),
              skipDuplicates: true,
            });
          }
        }

        return getTasksAction(projectId);
      }
    }
  }

  return dbTasks.map((t) => {
    const ownersDisplay = resolveOwnersDisplay(t.owners, t.ownerUser?.name, t.owner, t.ownerId, userMap);
    const resolvedTaskOwner = ownersDisplay.owners.length > 0
      ? ownersDisplay.owners.join(", ")
      : (t.ownerUser?.name && !isUserId(t.ownerUser.name) ? t.ownerUser.name : undefined) ||
        (t.owner && !isUserId(t.owner) ? t.owner : undefined) ||
        (t.ownerId && userMap.has(t.ownerId) ? userMap.get(t.ownerId) : undefined) ||
        "Unassigned";

    // Build comprehensive subtasks map from childTasks, ProjectSubtask, and matching parentTaskId rows
    const subtasksMap = new Map<string, TaskSubtask>();

    for (const ct of t.childTasks) {
      subtasksMap.set(ct.id, {
        id: ct.id,
        code: ct.code || ct.id,
        title: ct.title,
        status: (ct.status as TaskStatus) || "Open",
        ownerName: (ct.ownerUser?.name && !isUserId(ct.ownerUser.name) ? ct.ownerUser.name : undefined) ||
                   (ct.owner && !isUserId(ct.owner) ? ct.owner : undefined) ||
                   (ct.ownerId && userMap.has(ct.ownerId) ? userMap.get(ct.ownerId) : undefined) ||
                   "Unassigned",
        startDate: ct.startDate || "--",
        dueDate: ct.dueDate || "--",
        completed: ct.status === "Closed" || ct.completionPercentage >= 100,
        hasLink: false,
      });
    }

    for (const st of t.subtasks) {
      if (!subtasksMap.has(st.id)) {
        subtasksMap.set(st.id, {
          id: st.id,
          code: st.code || st.id,
          title: st.title,
          status: (st.status as TaskStatus) || "Open",
          ownerName: st.ownerName || "Unassigned",
          startDate: st.startDate || "--",
          dueDate: st.dueDate || "--",
          completed: st.completed || st.status === "Closed",
          hasLink: st.hasLink || false,
        });
      }
    }

    for (const other of dbTasks) {
      if (other.parentTaskId === t.id || (t.code && other.parentTaskId === t.code)) {
        if (!subtasksMap.has(other.id)) {
          subtasksMap.set(other.id, {
            id: other.id,
            code: other.code || other.id,
            title: other.title,
            status: (other.status as TaskStatus) || "Open",
            ownerName: other.owner || "Unassigned",
            startDate: other.startDate || "--",
            dueDate: other.dueDate || "--",
            completed: other.status === "Closed" || other.completionPercentage >= 100,
            hasLink: false,
          });
        }
      }
    }

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
    owner: resolvedTaskOwner,
    ownerId: t.ownerId || undefined,
    owners: ownersDisplay.owners.length > 0 ? ownersDisplay.owners : [resolvedTaskOwner],
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
    projectId: t.projectId || undefined,
    subtasks: Array.from(subtasksMap.values()),
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
  const userMap = await getUserMap();

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
    const ownersDisplay = resolveOwnersDisplay(t.owners, t.ownerUser?.name, t.owner, t.ownerId, userMap);
    const resolvedTaskOwner = ownersDisplay.owners.length > 0
      ? ownersDisplay.owners.join(", ")
      : (t.ownerUser?.name && !isUserId(t.ownerUser.name) ? t.ownerUser.name : undefined) ||
        (t.owner && !isUserId(t.owner) ? t.owner : undefined) ||
        (t.ownerId && userMap.has(t.ownerId) ? userMap.get(t.ownerId) : undefined) ||
        "Unassigned";

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
    owner: resolvedTaskOwner,
    ownerId: t.ownerId || undefined,
    owners: ownersDisplay.owners.length > 0 ? ownersDisplay.owners : [resolvedTaskOwner],
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
      ownerName: (ct.ownerUser?.name && !isUserId(ct.ownerUser.name) ? ct.ownerUser.name : undefined) ||
                 (ct.owner && !isUserId(ct.owner) ? ct.owner : undefined) ||
                 (ct.ownerId && userMap.has(ct.ownerId) ? userMap.get(ct.ownerId) : undefined) ||
                 "Unassigned",
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
  const userMap = await getUserMap();

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
        ...(uNameLower
          ? [
              { owner: { contains: userName, mode: "insensitive" as const } },
              { owner: { equals: userName, mode: "insensitive" as const } },
            ]
          : []),
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
    const ownersDisplay = resolveOwnersDisplay(t.owners, t.ownerUser?.name, t.owner, t.ownerId, userMap);
    const resolvedTaskOwner = ownersDisplay.owners.length > 0
      ? ownersDisplay.owners.join(", ")
      : (t.ownerUser?.name && !isUserId(t.ownerUser.name) ? t.ownerUser.name : undefined) ||
        (t.owner && !isUserId(t.owner) ? t.owner : undefined) ||
        (t.ownerId && userMap.has(t.ownerId) ? userMap.get(t.ownerId) : undefined) ||
        "Unassigned";

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
    owner: resolvedTaskOwner,
    ownerId: t.ownerId || undefined,
    owners: ownersDisplay.owners.length > 0 ? ownersDisplay.owners : [resolvedTaskOwner],
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
    projectId: t.projectId || undefined,
    subtasks: t.childTasks.map((ct) => ({
      id: ct.code || ct.id,
      code: ct.code || ct.id,
      title: ct.title,
      status: (ct.status as TaskStatus) || "Open",
      ownerName: (ct.ownerUser?.name && !isUserId(ct.ownerUser.name) ? ct.ownerUser.name : undefined) ||
                 (ct.owner && !isUserId(ct.owner) ? ct.owner : undefined) ||
                 (ct.ownerId && userMap.has(ct.ownerId) ? userMap.get(ct.ownerId) : undefined) ||
                 "Unassigned",
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

  // Fix 1: Use the project's ownerId FK directly as the default owner source of truth.
  // This is set before name-resolution so the FK is always the reliable fallback even
  // when no explicit owner was passed in taskData.
  const projectOwnerId: string | undefined = resolvedProject?.ownerId ?? undefined;

  // Resolve explicit owners from the UI picker (names/ids passed in taskData).
  // When the caller didn't supply any explicit owner, we skip name-resolution entirely
  // and rely on projectOwnerId (the FK) directly below.
  const explicitOwnerInput =
    taskData.owners && taskData.owners.length > 0
      ? taskData.owners
      : taskData.owner && taskData.owner !== "Unassigned"
      ? [taskData.owner]
      : [];

  const resolvedOwners = explicitOwnerInput.length
    ? await db.user.findMany({
        where: {
          OR: explicitOwnerInput.flatMap((o) => {
            const clean = o.trim();
            return [
              { id: clean },
              { name: { equals: clean, mode: "insensitive" } },
              { email: { equals: clean, mode: "insensitive" } },
              { name: { contains: clean, mode: "insensitive" } },
            ];
          }),
        },
      })
    : [];

  const ownerNames = Array.from(
    new Set(
      explicitOwnerInput.map((raw) => {
        const clean = raw.trim().toLowerCase();
        const match = resolvedOwners.find(
          (u) =>
            u.id === raw ||
            (u.name && u.name.trim().toLowerCase() === clean) ||
            u.email.trim().toLowerCase() === clean ||
            (u.name && u.name.trim().toLowerCase().includes(clean))
        );
        return match?.name || raw;
      })
    )
  );
  const ownerIdsResolved = Array.from(
    new Set(
      explicitOwnerInput
        .map((raw) => {
          const clean = raw.trim().toLowerCase();
          return resolvedOwners.find(
            (u) =>
              u.id === raw ||
              (u.name && u.name.trim().toLowerCase() === clean) ||
              u.email.trim().toLowerCase() === clean ||
              (u.name && u.name.trim().toLowerCase().includes(clean))
          )?.id;
        })
        .filter((id): id is string => Boolean(id))
    )
  );
  const primaryOwner = resolvedOwners[0];

  // Prefer a UI-resolved explicit owner first; fall back to the project's ownerId FK
  // directly — never rely solely on a name-to-user match for the default.
  const defaultOwnerId: string | undefined = primaryOwner?.id ?? projectOwnerId;

  // Compute display name: use resolved names if available, else look up the project owner's name.
  let displayOwnerName: string;
  if (ownerNames.length > 0) {
    displayOwnerName = ownerNames.join(", ");
  } else if (projectOwnerId) {
    // Fetch the project owner's name for display (ownerId is already resolved).
    const projectOwnerUser = await db.user.findUnique({
      where: { id: projectOwnerId },
      select: { name: true, email: true },
    });
    displayOwnerName = projectOwnerUser?.name || projectOwnerUser?.email || resolvedProject?.ownerName || "Unassigned";
  } else {
    displayOwnerName = "Unassigned";
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
      projectId: resolvedProject?.id || undefined,
      ownerId: defaultOwnerId,
      owner: displayOwnerName,
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

  // Fix 1 continued: finalOwnerIds uses the project FK directly when no explicit owner
  // was resolved — this guarantees a ProjectTaskOwner row is always created.
  const finalOwnerIds: string[] =
    ownerIdsResolved.length > 0
      ? ownerIdsResolved
      : defaultOwnerId
      ? [defaultOwnerId]
      : [];
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
    owner: displayOwnerName,
    owners: ownerNames.length > 0 ? ownerNames : (defaultOwnerId ? [displayOwnerName] : []),
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
            OR: namesInput.flatMap((o) => {
              const clean = o.trim();
              return [
                { id: clean },
                { name: { equals: clean, mode: "insensitive" } },
                { email: { equals: clean, mode: "insensitive" } },
                { name: { contains: clean, mode: "insensitive" } },
              ];
            }),
          },
        })
      : [];
    ownerNames = namesInput.map((raw) => {
      const clean = raw.trim().toLowerCase();
      const match = resolvedOwners.find(
        (u) =>
          u.id === raw ||
          (u.name && u.name.trim().toLowerCase() === clean) ||
          u.email.trim().toLowerCase() === clean ||
          (u.name && u.name.trim().toLowerCase().includes(clean))
      );
      return match?.name || raw;
    });
    ownerIdsResolved = Array.from(
      new Set(
        namesInput
          .map((raw) => {
            const clean = raw.trim().toLowerCase();
            return resolvedOwners.find(
              (u) =>
                u.id === raw ||
                (u.name && u.name.trim().toLowerCase() === clean) ||
                u.email.trim().toLowerCase() === clean ||
                (u.name && u.name.trim().toLowerCase().includes(clean))
            )?.id;
          })
          .filter((id): id is string => Boolean(id))
      )
    );
    ownerNames = Array.from(new Set(ownerNames));
    primaryOwnerId = ownerIdsResolved[0] ?? null;
  } else if (updates.owner) {
    const clean = updates.owner.trim();
    const ownerUser = await db.user.findFirst({
      where: {
        OR: [
          { id: clean },
          { name: { equals: clean, mode: "insensitive" } },
          { email: { equals: clean, mode: "insensitive" } },
          { name: { contains: clean, mode: "insensitive" } },
        ],
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
  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });
  const actorName = dbUser?.name || session.user.name || session.user.email || "Team Member";
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
    // Fix 4: Single-owner change should REPLACE the existing owner, not just add.
    // syncTaskOwners removes old owners no longer in the list, then adds the new one.
    await syncTaskOwners(task.id, [primaryOwnerId], session.user.id);
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

  if (updates.owners !== undefined || updates.owner !== undefined) {
    console.log("[DB SAVE SUCCESS] Task owners saved in database:", {
      taskId: task.id,
      taskCode: task.code,
      owners: newOwnerDisplay,
      ownerIdsResolved,
      primaryOwnerId,
    });
  }

  revalidatePath("/projects");
  revalidatePath("/projects/my-tasks");
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
      owner: true,
      ownerId: true,
      owners: { select: { userId: true } },
      project: { select: { ownerId: true, ownerName: true } },
    },
  });
  if (!parentTask) return null;

  const count = await db.projectTask.count({ where: { parentTaskId: parentTask.id } });

  // Subtask automatically inherits parent task's owner(s)
  const finalOwnerId = parentTask.ownerId;
  const finalOwnerName = parentTask.owner || "Unassigned";

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

  if (parentTask.owners && parentTask.owners.length > 0) {
    await db.projectTaskOwner.createMany({
      data: parentTask.owners.map((o) => ({
        taskId: created.id,
        userId: o.userId,
        assignedById: session.user.id,
      })),
      skipDuplicates: true,
    });
  } else if (finalOwnerId) {
    await db.projectTaskOwner.createMany({
      data: [{ taskId: created.id, userId: finalOwnerId, assignedById: session.user.id }],
      skipDuplicates: true,
    });
  }

  // Also persist in db.projectSubtask to guarantee persistence regardless of query path
  try {
    await db.projectSubtask.create({
      data: {
        id: created.id,
        code: created.code || created.id,
        title: created.title,
        status: created.status,
        ownerName: finalOwnerName,
        startDate: created.startDate || "--",
        dueDate: created.dueDate || "--",
        completed: subtaskData.completed || false,
        taskId: parentTask.id,
      },
    });
  } catch (e) {
    console.error("Subtask projectSubtask sync notice:", e);
  }

  revalidatePath("/projects");

  return {
    id: created.id,
    code: created.code || created.id,
    title: created.title,
    status: created.status as TaskStatus,
    ownerName: finalOwnerName,
    startDate: created.startDate || "--",
    dueDate: created.dueDate || "--",
    completed: created.status === "Closed" || created.completionPercentage >= 100,
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

  await db.projectSubtask.updateMany({
    where: { OR: [{ id: subtaskId }, { code: subtaskId }] },
    data: {
      ...(updates.title && { title: updates.title }),
      ...(updates.status && { status: updates.status }),
      ...(updates.completed !== undefined && { completed: updates.completed }),
      ...(updates.ownerName && { ownerName: updates.ownerName }),
    },
  }).catch(() => {});

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

  await db.projectSubtask.deleteMany({
    where: { OR: [{ id: subtaskId }, { code: subtaskId }] },
  }).catch(() => {});

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
    const matchingProjects = await db.project.findMany({
      where: {
        OR: [
          { id: { in: projectIds } },
          { code: { in: projectIds } },
        ],
      },
      select: { id: true },
    });

    const realProjectIds = matchingProjects.map((p) => p.id);

    if (realProjectIds.length > 0) {
      await db.projectMember.createMany({
        data: realProjectIds.map((projectId) => ({ projectId, userId: upsertedUser.id })),
        skipDuplicates: true,
      });
    }
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
  projectRole?: string | null;
  hourlyRate?: number;
  costRate?: number;
  weeklyCapacity?: number;
  status?: string;
  openTasksCount?: number;
  completedTasksCount?: number;
  totalLoggedHours?: string;
  totalLoggedMinutes?: number;
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

  // Fetch task counts & time logs for members in parallel
  const memberUserIds = members.map((m) => m.user.id);
  if (project.ownerId && !memberUserIds.includes(project.ownerId)) {
    memberUserIds.push(project.ownerId);
  }

  // Get tasks per user for this project
  const tasks = await db.projectTask.findMany({
    where: { projectId: project.id },
    select: {
      id: true,
      status: true,
      ownerId: true,
      owners: { select: { userId: true } },
    },
  });

  // Get time logs per user for this project
  const timeLogs = await db.projectTimeLog.findMany({
    where: { projectId: project.id },
    select: {
      userId: true,
      duration: true,
    },
  });

  // Build metrics per user
  const userMetrics: Record<
    string,
    { openTasks: number; completedTasks: number; totalMinutes: number }
  > = {};

  for (const uid of memberUserIds) {
    userMetrics[uid] = { openTasks: 0, completedTasks: 0, totalMinutes: 0 };
  }

  for (const task of tasks) {
    const taskOwnerIds = new Set<string>();
    if (task.ownerId) taskOwnerIds.add(task.ownerId);
    if (task.owners) {
      task.owners.forEach((o) => taskOwnerIds.add(o.userId));
    }
    const isCompleted = String(task.status || "").toUpperCase() === "CLOSED" ||
      String(task.status || "").toUpperCase() === "COMPLETED" ||
      String(task.status || "").toUpperCase() === "DONE";

    taskOwnerIds.forEach((uid) => {
      if (!userMetrics[uid]) {
        userMetrics[uid] = { openTasks: 0, completedTasks: 0, totalMinutes: 0 };
      }
      if (isCompleted) {
        userMetrics[uid].completedTasks += 1;
      } else {
        userMetrics[uid].openTasks += 1;
      }
    });
  }

  for (const log of timeLogs) {
    if (log.userId && userMetrics[log.userId]) {
      userMetrics[log.userId].totalMinutes += log.duration || 0;
    }
  }

  const formatHours = (totalMins: number) => {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} h`;
  };

  const memberUsers: ProjectMemberUser[] = members.map((m) => {
    const metrics = userMetrics[m.user.id] || {
      openTasks: 0,
      completedTasks: 0,
      totalMinutes: 0,
    };
    return {
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
      projectRole: m.projectRole || "Team Member",
      hourlyRate: m.hourlyRate ?? 0,
      costRate: m.costRate ?? 0,
      weeklyCapacity: m.weeklyCapacity ?? 40,
      status: m.status || "ACTIVE",
      openTasksCount: metrics.openTasks,
      completedTasksCount: metrics.completedTasks,
      totalLoggedHours: formatHours(metrics.totalMinutes),
      totalLoggedMinutes: metrics.totalMinutes,
    };
  });

  // If project owner is not in ProjectMember table, append owner
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
      const metrics = userMetrics[owner.id] || {
        openTasks: 0,
        completedTasks: 0,
        totalMinutes: 0,
      };
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
        projectRole: "Project Manager",
        hourlyRate: 0,
        costRate: 0,
        weeklyCapacity: 40,
        status: "ACTIVE",
        openTasksCount: metrics.openTasks,
        completedTasksCount: metrics.completedTasks,
        totalLoggedHours: formatHours(metrics.totalMinutes),
        totalLoggedMinutes: metrics.totalMinutes,
      });
    }
  }

  return memberUsers;
}

export async function updateProjectMemberDetailsAction(
  projectId: string,
  userId: string,
  data: {
    projectRole?: string;
    hourlyRate?: number;
    costRate?: number;
    weeklyCapacity?: number;
    status?: string;
  }
): Promise<boolean> {
  await requireAuth();

  const project = await db.project.findFirst({
    where: { OR: [{ id: projectId }, { code: projectId }] },
    select: { id: true },
  });
  const targetProjectId = project?.id || projectId;

  await db.projectMember.updateMany({
    where: {
      projectId: targetProjectId,
      userId: userId,
    },
    data: {
      ...(data.projectRole !== undefined && { projectRole: data.projectRole }),
      ...(data.hourlyRate !== undefined && { hourlyRate: data.hourlyRate }),
      ...(data.costRate !== undefined && { costRate: data.costRate }),
      ...(data.weeklyCapacity !== undefined && { weeklyCapacity: data.weeklyCapacity }),
      ...(data.status !== undefined && { status: data.status }),
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return true;
}

export async function getUserProjectDetailsDrawerAction(
  projectId: string,
  userId: string
) {
  await requireAuth();

  const project = await db.project.findFirst({
    where: { OR: [{ id: projectId }, { code: projectId }] },
    select: { id: true, name: true, ownerId: true },
  });

  if (!project) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      profileRole: true,
      title: true,
      department: true,
      workMobile: true,
      location: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  const member = await db.projectMember.findFirst({
    where: { projectId: project.id, userId },
  });

  // Get user's assigned tasks in this project
  const tasks = await db.projectTask.findMany({
    where: {
      projectId: project.id,
      OR: [
        { ownerId: userId },
        { owners: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      completionPercentage: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  // Get user's time logs in this project
  const rawTimeLogs = await db.projectTimeLog.findMany({
    where: { projectId: project.id, userId },
    select: {
      id: true,
      date: true,
      duration: true,
      billingType: true,
      description: true,
      task: { select: { title: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  let totalMinutes = 0;
  let billableMinutes = 0;
  let nonBillableMinutes = 0;

  const timeLogs = rawTimeLogs.map((log) => {
    const mins = log.duration || 0;
    totalMinutes += mins;
    if (log.billingType === "BILLABLE") {
      billableMinutes += mins;
    } else {
      nonBillableMinutes += mins;
    }

    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const hoursStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} h`;

    return {
      id: log.id,
      date: log.date.toISOString().split("T")[0],
      hours: hoursStr,
      logType: log.billingType,
      notes: log.description,
      task: log.task,
    };
  });

  const formattedTasks = tasks.map((t) => ({
    id: t.id,
    code: t.code,
    title: t.title,
    status: t.status,
    priority: t.priority,
    deadline: t.dueDate,
    progressPercent: t.completionPercentage,
  }));

  const formatMins = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")} h`;
  };

  return {
    user: {
      ...user,
      isOwner: user.id === project.ownerId,
      projectRole: member?.projectRole || (user.id === project.ownerId ? "Project Manager" : "Team Member"),
      hourlyRate: member?.hourlyRate ?? 0,
      costRate: member?.costRate ?? 0,
      weeklyCapacity: member?.weeklyCapacity ?? 40,
      status: member?.status || "ACTIVE",
      joinedAt: member?.joinedAt || member?.createdAt || user.createdAt,
    },
    tasks: formattedTasks,
    timeLogs,
    timeStats: {
      totalLogged: formatMins(totalMinutes),
      billableLogged: formatMins(billableMinutes),
      nonBillableLogged: formatMins(nonBillableMinutes),
    },
  };
}

export async function removeProjectMemberWithReassignmentAction(
  projectId: string,
  userId: string,
  reassignToUserId?: string
): Promise<boolean> {
  await requireAuth();

  const project = await db.project.findFirst({
    where: { OR: [{ id: projectId }, { code: projectId }] },
    select: { id: true },
  });
  const targetProjectId = project?.id || projectId;

  if (reassignToUserId) {
    // Reassign single owner tasks
    await db.projectTask.updateMany({
      where: { projectId: targetProjectId, ownerId: userId },
      data: { ownerId: reassignToUserId },
    });

    // Reassign multi-owner task join records
    const multiOwnerTasks = await db.projectTaskOwner.findMany({
      where: { userId, task: { projectId: targetProjectId } },
    });

    for (const record of multiOwnerTasks) {
      await db.projectTaskOwner.delete({ where: { id: record.id } });
      await db.projectTaskOwner.create({
        data: {
          taskId: record.taskId,
          userId: reassignToUserId,
          assignedById: record.assignedById,
        },
      });
    }
  }

  // Remove project member record
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
  const session = await requireAuth();
  if (!(await isPrivilegedViewer(session.user.id, projectId))) {
    throw new Error("Only a manager can add members to a project.");
  }
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

      // A project with no recorded ProjectMember rows (e.g. created without ever running
      // "Add Member") must not leave the picker showing only the auto-added owner — fall
      // through to the org-wide roster below in that case, same as a project with none.
      if (targetUsers.length > 0 && project.ownerId && !targetUsers.some((u) => u.id === project.ownerId)) {
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

import {
  parseDurationMinutes,
  formatDurationDisplay,
  formatMinutesToHHMM,
  encodeDescriptionWithTimePeriod,
  decodeDescriptionWithTimePeriod,
  resolveLogTimePeriod,
  formatTimePeriodRange,
  parseDateAndTimeToDate,
} from "../utils/time-helpers";

function formatMinutes(totalMinutes: number): string {
  return formatMinutesToHHMM(totalMinutes);
}

async function recalculateProjectTimeTotals(projectId: string) {
  if (!projectId) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const project = await d.project.findFirst({
    where: { OR: [{ id: projectId }, { code: projectId }] },
    select: { id: true, code: true, name: true },
  });
  if (!project) return;

  const logs = await d.projectTimeLog.findMany({
    where: { projectId: project.id },
    select: { duration: true, billingType: true },
  });

  let totalMinutes = 0;
  let billableMinutes = 0;
  let nonBillableMinutes = 0;

  for (const log of logs) {
    const mins = parseDurationMinutes(log.duration);
    totalMinutes += mins;
    if (log.billingType === "BILLABLE") {
      billableMinutes += mins;
    } else {
      nonBillableMinutes += mins;
    }
  }

  const formatHoursStr = (m: number) => {
    const hrs = Math.floor(m / 60);
    const mins = m % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")} h`;
  };

  await d.project.update({
    where: { id: project.id },
    data: {
      totalHours: formatHoursStr(totalMinutes),
      billableHours: formatHoursStr(billableMinutes),
      nonBillableHours: formatHoursStr(nonBillableMinutes),
    },
  });
}

async function recalculateTaskWorkHours(taskCodeOrId: string) {
  if (!taskCodeOrId) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const task = await d.projectTask.findFirst({
    where: { OR: [{ id: taskCodeOrId }, { code: taskCodeOrId }] },
    select: { id: true, code: true },
  });
  if (!task) return;

  const logs = await d.projectTimeLog.findMany({
    where: { taskId: task.id },
    select: { duration: true },
  });

  let totalMinutes = 0;
  for (const log of logs) {
    totalMinutes += parseDurationMinutes(log.duration);
  }

  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const workHoursStr = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;

  await d.projectTask.update({
    where: { id: task.id },
    data: { workHours: workHoursStr },
  });
}

export async function getTimeLogsAction(projectId?: string): Promise<UserTimeGroup[]> {
  const session = await requireAuth();
  const isClient = await isClientUser(session.user.id);
  const canViewAll = isClient || (await isPrivilegedViewer(session.user.id, projectId));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  let projectFilter: any = {};
  if (projectId) {
    const project = await d.project.findFirst({
      where: { OR: [{ id: projectId }, { code: projectId }] },
      select: { id: true, code: true, name: true },
    });

    if (project) {
      projectFilter = { projectId: project.id };
    } else {
      projectFilter = { projectId: projectId };
    }
  }

  const ownershipFilter = canViewAll
    ? {}
    : { userId: session.user.id };

  const dbLogs = await d.projectTimeLog.findMany({
    where: { ...projectFilter, ...ownershipFilter },
    include: {
      user: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      task: { select: { id: true, code: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const userMap = new Map<string, UserTimeGroup>();

  dbLogs.forEach((log: any) => {
    const userName = log.user?.name || session.user.name || "User";
    const initials = userName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    if (!userMap.has(userName)) {
      userMap.set(userName, {
        userId: log.userId || log.id,
        userName: userName,
        userInitials: initials,
        avatarColor: "bg-primary text-primary-foreground",
        dailyLogHours: "00:00 | 00:00 | 00:00",
        timeLogs: [],
      });
    }

    const { timePeriod, remarks } = decodeDescriptionWithTimePeriod(log.description);
    const durationMinutes = typeof log.duration === "number" ? log.duration : parseDurationMinutes(log.duration);
    const durationStr = formatDurationDisplay(durationMinutes);
    const dateStr = log.date instanceof Date ? log.date.toISOString().split("T")[0] : String(log.date || "");
    const finalTimePeriod = resolveLogTimePeriod(timePeriod, durationMinutes, log.createdAt || log.date);

    const taskCode = log.task?.code || undefined;
    const displayCode = taskCode || log.id;

    const group = userMap.get(userName)!;
    group.timeLogs.push({
      id: log.id,
      code: displayCode,
      title: log.task?.title || remarks || "Logged Work",
      project: log.project?.name || "Project",
      projectId: log.projectId || undefined,
      taskCode: displayCode,
      duration: durationStr,
      timePeriod: finalTimePeriod,
      date: dateStr,
      billingType: log.billingType === "BILLABLE" ? "BILLABLE" : "NON BILLABLE",
      remarks: remarks || log.rejectionReason || "",
      approvalStatus: log.approvalStatus as any,
      userName: userName,
      userInitials: initials,
      userId: log.userId || undefined,
      createdAt: log.createdAt ? new Date(log.createdAt).toISOString() : new Date().toISOString(),
    });
  });

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
  const isClient = await isClientUser(session.user.id);
  if (isClient) {
    throw new Error("Client users have read-only access and cannot create time logs.");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const rawTaskId = (logData as any).taskId || logData.taskCode;
  const task = await d.projectTask.findFirst({
    where: { OR: [{ id: rawTaskId }, { code: rawTaskId }] },
    select: { id: true, code: true, title: true, phaseId: true, projectId: true },
  });

  const rawProjectId = projectId || logData.projectId || (logData as any).project || task?.projectId;
  let project = await d.project.findFirst({
    where: { OR: [{ id: rawProjectId }, { code: rawProjectId }] },
    select: { id: true, name: true, code: true },
  });

  if (!project && task?.projectId) {
    project = await d.project.findUnique({
      where: { id: task.projectId },
      select: { id: true, name: true, code: true },
    });
  }

  if (!project) {
    throw new Error("Project not found");
  }
  if (!task) {
    throw new Error("Task not found");
  }

  const phaseId = (logData as any).phaseId || task.phaseId;
  let phase: any = null;

  if (phaseId) {
    phase = await d.projectPhase.findFirst({
      where: { id: phaseId, projectId: project.id },
      select: { id: true, name: true, code: true },
    });
  }

  if (!phase) {
    phase = await d.projectPhase.findFirst({
      where: { projectId: project.id },
      orderBy: { order: "asc" },
      select: { id: true, name: true, code: true },
    });
  }

  if (!phase) {
    phase = await d.projectPhase.create({
      data: {
        code: "P1",
        name: "Phase 1",
        projectId: project.id,
      },
      select: { id: true, name: true, code: true },
    });
  }

  if (!task.phaseId) {
    await d.projectTask.update({
      where: { id: task.id },
      data: { phaseId: phase.id },
    });
  }

  let durationMinutes = parseDurationMinutes(logData.duration);
  if (durationMinutes <= 0) durationMinutes = 60;

  let timePeriodStr = logData.timePeriod || "";
  if (durationMinutes > 720) {
    timePeriodStr = "";
  }
  const description = encodeDescriptionWithTimePeriod(logData.remarks || logData.title, timePeriodStr);
  const startTimePart = timePeriodStr ? timePeriodStr.split(/[-–]/)[0]?.trim() : undefined;
  const logDate = parseDateAndTimeToDate(logData.date, startTimePart);

  const newLog = await d.projectTimeLog.create({
    data: {
      projectId: project.id,
      phaseId: phase.id,
      taskId: task.id,
      userId: session.user.id,
      date: logDate,
      duration: durationMinutes,
      billingType: logData.billingType === "BILLABLE" ? "BILLABLE" : "NON_BILLABLE",
      approvalStatus: "PENDING",
      description,
    },
    include: {
      project: true,
      phase: true,
      task: true,
      user: true,
    },
  });

  if (project.id) {
    await recalculateProjectTimeTotals(project.id);
  }
  if (task.id) {
    await recalculateTaskWorkHours(task.id);
  }

  revalidatePath(`/projects/${project.id}/time-tracker`);
  revalidatePath(`/projects/${project.id}/tasks/${task.code}`);
  revalidatePath(`/projects/${project.id}/tasks/${task.id}`);
  revalidatePath(`/projects/${project.id}`);
  revalidatePath("/projects/time-tracker");

  const { timePeriod: decodedTimePeriod, remarks: decodedRemarks } = decodeDescriptionWithTimePeriod(newLog.description);
  const finalTimePeriod = resolveLogTimePeriod(decodedTimePeriod, newLog.duration, newLog.createdAt || newLog.date);

  const taskCode = newLog.task?.code || task.code || undefined;
  const displayCode = taskCode || newLog.id;

  return {
    id: newLog.id,
    code: displayCode,
    title: newLog.task?.title || decodedRemarks || "Logged Work",
    project: newLog.project?.name || "Project",
    projectId: newLog.projectId,
    taskCode: displayCode,
    duration: formatDurationDisplay(newLog.duration),
    timePeriod: finalTimePeriod,
    date: newLog.date instanceof Date ? newLog.date.toISOString().split("T")[0] : String(newLog.date),
    billingType: newLog.billingType === "BILLABLE" ? "BILLABLE" : "NON BILLABLE",
    remarks: decodedRemarks || "",
    approvalStatus: newLog.approvalStatus,
    userName: newLog.user?.name || session.user.name || "User",
    userInitials: "US",
    userId: newLog.userId,
    createdAt: newLog.createdAt.toISOString(),
  };
}

export async function updateTimeLogAction(
  logId: string,
  updates: Partial<TimeLogEntry>
): Promise<boolean> {
  const session = await requireAuth();
  const isClient = await isClientUser(session.user.id);
  if (isClient) {
    throw new Error("Client users have read-only access and cannot edit time logs.");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const existingLog = await d.projectTimeLog.findUnique({
    where: { id: logId },
  });

  if (!existingLog) return false;

  const isManager = await isPrivilegedViewer(session.user.id);
  if (!isManager && existingLog.userId !== session.user.id) {
    throw new Error("You do not have permission to edit this time log.");
  }

  const dataToUpdate: any = {};
  if (updates.date) {
    const startTimePart = updates.timePeriod ? updates.timePeriod.split(/[-–]/)[0]?.trim() : undefined;
    dataToUpdate.date = parseDateAndTimeToDate(updates.date, startTimePart);
  }
  if (updates.duration !== undefined) {
    const mins = parseDurationMinutes(updates.duration);
    if (mins > 0) {
      dataToUpdate.duration = mins;
    }
  }
  if (updates.billingType) {
    dataToUpdate.billingType = updates.billingType === "BILLABLE" ? "BILLABLE" : "NON_BILLABLE";
  }
  if (updates.remarks !== undefined || updates.timePeriod !== undefined) {
    const { timePeriod: existingTp, remarks: existingRem } = decodeDescriptionWithTimePeriod(existingLog.description);
    const newRemarks = updates.remarks !== undefined ? updates.remarks : existingRem;
    let newTp = updates.timePeriod !== undefined ? updates.timePeriod : existingTp;
    const finalDuration = dataToUpdate.duration !== undefined ? dataToUpdate.duration : existingLog.duration;
    if (finalDuration > 720) {
      newTp = "";
    }
    dataToUpdate.description = encodeDescriptionWithTimePeriod(newRemarks, newTp);
  }
  if (updates.approvalStatus && isManager) {
    dataToUpdate.approvalStatus = updates.approvalStatus.toUpperCase();
  }

  await d.projectTimeLog.update({
    where: { id: logId },
    data: dataToUpdate,
  });

  if (existingLog.projectId) {
    await recalculateProjectTimeTotals(existingLog.projectId);
  }
  if (existingLog.taskId) {
    await recalculateTaskWorkHours(existingLog.taskId);
  }

  revalidatePath("/projects/time-tracker");
  return true;
}

export async function deleteTimeLogAction(logId: string): Promise<boolean> {
  const session = await requireAuth();
  const isClient = await isClientUser(session.user.id);
  if (isClient) {
    throw new Error("Client users have read-only access and cannot delete time logs.");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const existingLog = await d.projectTimeLog.findUnique({
    where: { id: logId },
  });

  if (!existingLog) return false;

  const isManager = await isPrivilegedViewer(session.user.id);
  if (!isManager) {
    throw new Error("Only managers can delete time logs.");
  }

  await d.projectTimeLog.delete({
    where: { id: logId },
  });

  if (existingLog.projectId) {
    await recalculateProjectTimeTotals(existingLog.projectId);
  }

  revalidatePath("/projects/time-tracker");
  return true;
}

export async function approveTimeLogsAction(logIds: string[]): Promise<boolean> {
  const session = await requireAuth();
  const isManager = await isPrivilegedViewer(session.user.id);
  if (!isManager) throw new Error("Only managers can approve time logs.");

  if (!logIds || logIds.length === 0) return true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  await d.projectTimeLog.updateMany({
    where: { id: { in: logIds } },
    data: { approvalStatus: "APPROVED", rejectionReason: null },
  });

  revalidatePath("/projects/time-tracker");
  return true;
}

export async function rejectTimeLogsAction(
  logIds: string[],
  reason?: string
): Promise<boolean> {
  const session = await requireAuth();
  const isManager = await isPrivilegedViewer(session.user.id);
  if (!isManager) throw new Error("Only managers can reject time logs.");

  if (!logIds || logIds.length === 0) return true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  await d.projectTimeLog.updateMany({
    where: { id: { in: logIds } },
    data: { approvalStatus: "REJECTED", rejectionReason: reason || "Rejected by manager" },
  });

  revalidatePath("/projects/time-tracker");
  return true;
}

export interface ProjectTimeSummary {
  totalHoursStr: string;
  billableHoursStr: string;
  nonBillableHoursStr: string;
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  userBreakdown: {
    userId: string;
    userName: string;
    userInitials: string;
    avatarColor: string;
    totalHoursStr: string;
    totalMinutes: number;
    billableMinutes: number;
    nonBillableMinutes: number;
  }[];
  taskBreakdown: {
    taskCode: string;
    taskTitle: string;
    totalHoursStr: string;
    totalMinutes: number;
  }[];
}

export async function getProjectTimeLogSummaryAction(projectId: string): Promise<ProjectTimeSummary> {
  const session = await requireAuth();
  const isClient = await isClientUser(session.user.id);
  const canViewAll = isClient || (await isPrivilegedViewer(session.user.id, projectId));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const project = await d.project.findFirst({
    where: { OR: [{ id: projectId }, { code: projectId }] },
    select: { id: true, code: true, name: true },
  });

  const ownershipFilter = canViewAll ? {} : { userId: session.user.id };

  const logs = await d.projectTimeLog.findMany({
    where: { projectId: project?.id || projectId, ...ownershipFilter },
    include: {
      user: { select: { id: true, name: true } },
      task: { select: { id: true, code: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  let totalMinutes = 0;
  let billableMinutes = 0;
  let nonBillableMinutes = 0;

  const userMap = new Map<string, {
    userId: string;
    userName: string;
    userInitials: string;
    avatarColor: string;
    totalMinutes: number;
    billableMinutes: number;
    nonBillableMinutes: number;
  }>();

  const taskMap = new Map<string, {
    taskCode: string;
    taskTitle: string;
    totalMinutes: number;
  }>();

  for (const log of logs) {
    const mins = typeof log.duration === "number" ? log.duration : parseDurationMinutes(log.duration);
    totalMinutes += mins;
    if (log.billingType === "BILLABLE") {
      billableMinutes += mins;
    } else {
      nonBillableMinutes += mins;
    }

    const userName = log.user?.name || session.user.name || "User";
    const initials = userName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    if (!userMap.has(userName)) {
      userMap.set(userName, {
        userId: log.userId || log.id,
        userName,
        userInitials: initials,
        avatarColor: "bg-primary text-primary-foreground",
        totalMinutes: 0,
        billableMinutes: 0,
        nonBillableMinutes: 0,
      });
    }
    const uEntry = userMap.get(userName)!;
    uEntry.totalMinutes += mins;
    if (log.billingType === "BILLABLE") uEntry.billableMinutes += mins;
    else uEntry.nonBillableMinutes += mins;

    const tCode = log.task?.code || "General";
    const tTitle = log.task?.title || "Direct Project Time";
    if (!taskMap.has(tCode)) {
      taskMap.set(tCode, {
        taskCode: tCode,
        taskTitle: tTitle,
        totalMinutes: 0,
      });
    }
    const tEntry = taskMap.get(tCode)!;
    tEntry.totalMinutes += mins;
  }

  const formatHoursStr = (m: number) => {
    const hrs = Math.floor(m / 60);
    const mins = m % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")} h`;
  };

  return {
    totalHoursStr: formatHoursStr(totalMinutes),
    billableHoursStr: formatHoursStr(billableMinutes),
    nonBillableHoursStr: formatHoursStr(nonBillableMinutes),
    totalMinutes,
    billableMinutes,
    nonBillableMinutes,
    userBreakdown: Array.from(userMap.values()).map((u) => ({
      ...u,
      totalHoursStr: formatHoursStr(u.totalMinutes),
    })),
    taskBreakdown: Array.from(taskMap.values()).map((t) => ({
      ...t,
      totalHoursStr: formatHoursStr(t.totalMinutes),
    })),
  };
}

export async function getTaskTimeLogsAction(taskCodeOrId: string): Promise<TimeLogEntry[]> {
  const session = await requireAuth();
  const canViewAll = await isPrivilegedViewer(session.user.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const task = await d.projectTask.findFirst({
    where: { OR: [{ id: taskCodeOrId }, { code: taskCodeOrId }] },
    select: { id: true, code: true, projectId: true },
  });

  if (!task) {
    return [];
  }

  const ownershipFilter = canViewAll ? {} : { userId: session.user.id };

  const logs = await d.projectTimeLog.findMany({
    where: {
      taskId: task.id,
      ...ownershipFilter,
    },
    include: {
      user: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return logs.map((log: any) => {
    const { timePeriod, remarks } = decodeDescriptionWithTimePeriod(log.description);
    const durationMins = typeof log.duration === "number" ? log.duration : parseDurationMinutes(log.duration);
    const finalTimePeriod = resolveLogTimePeriod(timePeriod, durationMins, log.createdAt || log.date);
    const taskCode = log.task?.code || task.code || undefined;
    const displayCode = taskCode || log.id;
    return {
      id: log.id,
      code: displayCode,
      title: remarks || log.task?.title || "Logged Work",
      project: log.project?.name || "Project",
      projectId: log.projectId || undefined,
      taskCode: displayCode,
      duration: formatDurationDisplay(durationMins),
      timePeriod: finalTimePeriod,
      date: log.date instanceof Date ? log.date.toISOString().split("T")[0] : String(log.date),
      billingType: log.billingType === "BILLABLE" ? "BILLABLE" : "NON BILLABLE",
      remarks: remarks || "",
      approvalStatus: log.approvalStatus as any,
      userName: log.user?.name || session.user.name || "User",
      userInitials: "US",
      userId: log.userId || undefined,
      createdAt: log.createdAt ? new Date(log.createdAt).toISOString() : new Date().toISOString(),
    };
  });
}

export async function getCurrentUserRoleAction(projectId?: string): Promise<WorkspaceRole> {
  const session = await auth();
  if (!session?.user?.id) {
    return "TEAM_MEMBER";
  }

  const isClient = await isClientUser(session.user.id);
  if (isClient) {
    return "CLIENT" as any;
  }

  const isPrivileged = await isPrivilegedViewer(session.user.id, projectId);
  return isPrivileged ? "ADMIN" : "TEAM_MEMBER";
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

/**
 * ----------------------------------------------------
 * PROJECT DOCUMENTS & STATUS TIMELINE ACTIONS
 * ----------------------------------------------------
 */

export async function getProjectDocumentsAction(projectId: string): Promise<ProjectDocument[]> {
  await requireAuth();

  const docs = await db.userDocument.findMany({
    where: {
      kind: { startsWith: `PROJECT:${projectId}` },
    },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });

  return docs.map((d) => {
    const parts = d.kind.split(":");
    const mimeType = parts[2] || "application/octet-stream";
    const sizeBytes = parseInt(parts[3] || "0", 10);
    const uploadedBy = d.user?.name || d.user?.email || "Team Member";

    return {
      id: d.id,
      projectId,
      name: d.fileName,
      fileUrl: d.fileUrl,
      sizeBytes,
      mimeType,
      uploadedBy,
      createdAt: d.createdAt.toISOString(),
    };
  });
}

export async function saveProjectDocumentAction(docData: {
  projectId: string;
  name: string;
  fileUrl: string;
  sizeBytes?: number;
  mimeType?: string;
}): Promise<ProjectDocument> {
  const session = await requireAuth();

  const kind = `PROJECT:${docData.projectId}:${docData.mimeType || "file"}:${docData.sizeBytes || 0}`;

  const created = await db.userDocument.create({
    data: {
      userId: session.user.id,
      kind,
      fileUrl: docData.fileUrl,
      fileName: docData.name,
    },
    include: { user: { select: { name: true, email: true } } },
  });

  revalidatePath(`/projects/${docData.projectId}`);

  return {
    id: created.id,
    projectId: docData.projectId,
    name: created.fileName,
    fileUrl: created.fileUrl,
    sizeBytes: docData.sizeBytes || 0,
    mimeType: docData.mimeType || "application/octet-stream",
    uploadedBy: created.user?.name || session.user.name || "User",
    createdAt: created.createdAt.toISOString(),
  };
}

export async function deleteProjectDocumentAction(docId: string, projectId: string): Promise<boolean> {
  await requireAuth();

  await db.userDocument.delete({
    where: { id: docId },
  });

  revalidatePath(`/projects/${projectId}`);
  return true;
}

export async function getProjectTimelineAction(projectId: string): Promise<ProjectTimelineEvent[]> {
  await requireAuth();

  const [project, tasks, docs] = await Promise.all([
    db.project.findFirst({
      where: { OR: [{ id: projectId }, { code: projectId }] },
      include: {
        owner: { select: { name: true, email: true } },
        createdByUser: { select: { name: true, email: true } },
        phases: true,
      },
    }),
    db.projectTask.findMany({
      where: { OR: [{ projectId }, { project: { code: projectId } }] },
      include: {
        activities: true,
        author: { select: { name: true } },
        ownerUser: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.userDocument.findMany({
      where: { kind: { startsWith: `PROJECT:${projectId}` } },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!project) return [];

  const timelineEvents: ProjectTimelineEvent[] = [];

  const creatorName =
    project.createdByUser?.name ||
    project.owner?.name ||
    project.ownerName ||
    "System Administrator";

  // Project Creation Event
  timelineEvents.push({
    id: `creation-${project.id}`,
    projectId: project.id,
    type: "CREATED",
    title: "Project Created",
    description: `Project "${project.name}" (${project.code || project.id}) was created with owner "${project.ownerName || creatorName}".`,
    actorName: creatorName,
    actorAvatarColor: "bg-emerald-600 text-white",
    timestamp: project.createdAt.toISOString(),
  });

  // Project Update Event
  if (project.updatedAt > project.createdAt) {
    timelineEvents.push({
      id: `updated-${project.id}`,
      projectId: project.id,
      type: "UPDATED",
      title: "Project Details Updated",
      description: `Project status is currently "${project.status}" and progress is ${project.progressPercent}%.`,
      actorName: creatorName,
      actorAvatarColor: "bg-blue-600 text-white",
      timestamp: project.updatedAt.toISOString(),
    });
  }

  // Phase Completion Events
  for (const ph of project.phases) {
    if (ph.isCompleted) {
      timelineEvents.push({
        id: `phase-${ph.id}`,
        projectId: project.id,
        type: "PHASE_COMPLETED",
        title: `Phase ${ph.code} Completed`,
        description: `Phase "${ph.name}" was marked as completed.`,
        actorName: creatorName,
        actorAvatarColor: "bg-[var(--theme-info)] text-white",
        timestamp: ph.createdAt.toISOString(),
      });
    }
  }

  // Task Creation and Activity Events
  for (const task of tasks) {
    timelineEvents.push({
      id: `task-${task.id}`,
      projectId: project.id,
      type: "TASK_ADDED",
      title: `Task Created: ${task.code}`,
      description: `Task "${task.title}" was created and assigned to ${task.owner || "Unassigned"}.`,
      actorName: task.authorName || task.author?.name || "Team Member",
      actorAvatarColor: "bg-indigo-600 text-white",
      timestamp: task.createdAt.toISOString(),
    });

    for (const act of task.activities) {
      timelineEvents.push({
        id: `act-${act.id}`,
        projectId: project.id,
        type: "UPDATED",
        title: `Task Activity (${task.code})`,
        description: act.actionText,
        actorName: act.userName,
        actorAvatarColor: "bg-purple-600 text-white",
        timestamp: act.createdAt.toISOString(),
      });
    }
  }

  // Document Upload Events
  for (const d of docs) {
    timelineEvents.push({
      id: `doc-${d.id}`,
      projectId: project.id,
      type: "DOCUMENT_UPLOADED",
      title: "Document Uploaded",
      description: `Uploaded attachment "${d.fileName}".`,
      actorName: d.user?.name || d.user?.email || "Team Member",
      actorAvatarColor: "bg-amber-600 text-white",
      timestamp: d.createdAt.toISOString(),
    });
  }

  return timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * ----------------------------------------------------
 * TASK DOCUMENTS & TASK STATUS TIMELINE ACTIONS
 * ----------------------------------------------------
 */

export async function getTaskDocumentsAction(taskIdOrCode: string): Promise<ProjectDocument[]> {
  await requireAuth();

  const docs = await db.userDocument.findMany({
    where: {
      OR: [
        { kind: { startsWith: `TASK:${taskIdOrCode}` } },
        { kind: { contains: `:${taskIdOrCode}:` } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });

  return docs.map((d) => {
    const parts = d.kind.split(":");
    const mimeType = parts[2] || "application/octet-stream";
    const sizeBytes = parseInt(parts[3] || "0", 10);
    const uploadedBy = d.user?.name || d.user?.email || "Team Member";

    return {
      id: d.id,
      projectId: parts[4] || "",
      name: d.fileName,
      fileUrl: d.fileUrl,
      sizeBytes,
      mimeType,
      uploadedBy,
      createdAt: d.createdAt.toISOString(),
    };
  });
}

export async function saveTaskDocumentAction(docData: {
  taskId: string;
  projectId: string;
  name: string;
  fileUrl: string;
  sizeBytes?: number;
  mimeType?: string;
}): Promise<ProjectDocument> {
  const session = await requireAuth();

  const kind = `TASK:${docData.taskId}:${docData.mimeType || "file"}:${docData.sizeBytes || 0}:${docData.projectId}`;

  const created = await db.userDocument.create({
    data: {
      userId: session.user.id,
      kind,
      fileUrl: docData.fileUrl,
      fileName: docData.name,
    },
    include: { user: { select: { name: true, email: true } } },
  });

  const task = await db.projectTask.findFirst({
    where: { OR: [{ id: docData.taskId }, { code: docData.taskId }] },
    select: { id: true },
  });

  const actorName = created.user?.name || session.user.name || session.user.email || "Team Member";

  if (task) {
    await db.projectTaskActivity.create({
      data: {
        userName: actorName,
        userId: session.user.id,
        userInitials: toInitials(actorName),
        actionText: `uploaded attachment "${docData.name}"`,
        taskId: task.id,
      },
    });
  }

  revalidatePath(`/projects/${docData.projectId}/tasks/${docData.taskId}`);

  return {
    id: created.id,
    projectId: docData.projectId,
    name: created.fileName,
    fileUrl: created.fileUrl,
    sizeBytes: docData.sizeBytes || 0,
    mimeType: docData.mimeType || "application/octet-stream",
    uploadedBy: actorName,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function deleteTaskDocumentAction(docId: string, taskId: string): Promise<boolean> {
  await requireAuth();

  await db.userDocument.delete({
    where: { id: docId },
  });

  return true;
}

export async function getTaskTimelineAction(taskIdOrCode: string): Promise<ProjectTimelineEvent[]> {
  await requireAuth();

  const task = await db.projectTask.findFirst({
    where: { OR: [{ id: taskIdOrCode }, { code: taskIdOrCode }] },
    include: {
      author: { select: { name: true, email: true } },
      activities: { orderBy: { createdAt: "desc" } },
      subtasks: { orderBy: { createdAt: "desc" } },
      project: { select: { id: true, name: true, ownerName: true, createdAt: true } },
    },
  });

  if (!task) return [];

  const docs = await db.userDocument.findMany({
    where: {
      OR: [
        { kind: { startsWith: `TASK:${task.id}` } },
        { kind: { startsWith: `TASK:${task.code}` } },
      ],
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const timelineEvents: ProjectTimelineEvent[] = [];

  // 1. Task Created Event
  const creatorName = task.authorName || task.author?.name || "Team Member";
  timelineEvents.push({
    id: `creation-${task.id}`,
    projectId: task.projectId || "",
    type: "CREATED",
    title: `${creatorName} created this task`,
    description: `Task "${task.title}" (${task.code}) was created and assigned to ${task.owner || "Unassigned"}.`,
    actorName: creatorName,
    actorAvatarColor: "bg-emerald-600 text-white",
    timestamp: task.createdAt.toISOString(),
  });

  // 2. Activity Logs
  for (const act of task.activities) {
    timelineEvents.push({
      id: `act-${act.id}`,
      projectId: task.projectId || "",
      type: "UPDATED",
      title: `${act.userName} ${act.actionText}`,
      description: `Task activity update recorded.`,
      actorName: act.userName,
      actorAvatarColor: "bg-blue-600 text-white",
      timestamp: act.createdAt.toISOString(),
    });
  }

  // 3. Subtask Events
  for (const st of task.subtasks) {
    timelineEvents.push({
      id: `sub-${st.id}`,
      projectId: task.projectId || "",
      type: "TASK_ADDED",
      title: `Subtask ${st.completed ? 'completed' : 'added'}: "${st.title}"`,
      description: `Subtask "${st.title}" is ${st.status.toLowerCase()} and assigned to ${st.ownerName || "Unassigned"}.`,
      actorName: st.ownerName || "Team Member",
      actorAvatarColor: "bg-purple-600 text-white",
      timestamp: st.createdAt.toISOString(),
    });
  }

  // 4. Document Attachments
  for (const d of docs) {
    timelineEvents.push({
      id: `doc-${d.id}`,
      projectId: task.projectId || "",
      type: "DOCUMENT_UPLOADED",
      title: `${d.user?.name || "User"} uploaded document "${d.fileName}"`,
      description: `Attached file "${d.fileName}" to task.`,
      actorName: d.user?.name || d.user?.email || "Team Member",
      actorAvatarColor: "bg-amber-600 text-white",
      timestamp: d.createdAt.toISOString(),
    });
  }

  return timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

