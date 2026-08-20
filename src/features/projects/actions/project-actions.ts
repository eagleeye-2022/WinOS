"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Project, ProjectPhase, TaskItem, TimeLogEntry, UserTimeGroup, ProjectUser } from "../types";
import { DEFAULT_PROJECT_PHASES, INITIAL_MOCK_PROJECTS } from "../data/mock-projects";
import { INITIAL_MOCK_TASKS } from "../data/mock-tasks";
import { INITIAL_MOCK_TIME_GROUPS } from "../data/mock-time-logs";
import { INITIAL_MOCK_USERS } from "../data/mock-users";

/**
 * ----------------------------------------------------
 * PROJECTS CRUD ACTIONS
 * ----------------------------------------------------
 */

export async function getProjectsAction(): Promise<Project[]> {
  try {
    let dbProjects = await db.project.findMany({
      include: {
        phases: {
          orderBy: { order: "asc" },
        },
        tasks: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Seed mock data if table is completely empty
    if (dbProjects.length === 0) {
      for (const p of INITIAL_MOCK_PROJECTS) {
        await db.project.create({
          data: {
            code: p.id,
            name: p.name,
            progressPercent: p.progressPercent,
            ownerName: p.owner.name,
            ownerInitials: p.owner.initials,
            ownerAvatarColor: p.owner.avatarColor,
            status: p.status,
            totalHours: p.totalHours,
            billableHours: p.billableHours,
            nonBillableHours: p.nonBillableHours,
            startDate: p.startDate,
            deadline: p.deadline,
            phases: {
              create: DEFAULT_PROJECT_PHASES.map((ph, idx) => ({
                code: ph.code,
                name: ph.name,
                isCompleted: ph.isCompleted || false,
                order: idx,
              })),
            },
          },
        });
      }

      dbProjects = await db.project.findMany({
        include: {
          phases: { orderBy: { order: "asc" } },
          tasks: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return dbProjects.map((p) => {
      const completedPhases = p.phases.filter((ph) => ph.isCompleted).length;
      const completedTasks = p.tasks.filter((t) => t.status === "Closed" || t.status === "CLOSED").length;
      const totalTasks = p.tasks.length || 50;

      return {
        id: p.code || p.id,
        name: p.name,
        progressPercent: p.progressPercent,
        owner: {
          id: p.ownerId || "u-default",
          name: p.ownerName || "Dhruv Patidar",
          initials: p.ownerInitials || "DP",
          avatarColor: p.ownerAvatarColor || "bg-warning text-warning-foreground",
        },
        status: p.status as "ACTIVE" | "COMPLETED" | "ARCHIVED",
        totalHours: p.totalHours,
        billableHours: p.billableHours,
        nonBillableHours: p.nonBillableHours,
        startDate: p.startDate || "11/07/2026",
        deadline: p.deadline || "01/01/2027",
        completedTasksCount: completedTasks,
        totalTasksCount: totalTasks,
        taskProgressPercent: Math.round((completedTasks / (totalTasks || 1)) * 100),
        completedPhasesCount: completedPhases,
        totalPhasesCount: p.phases.length || 7,
        phases: p.phases.map((ph) => ({
          id: ph.id,
          code: ph.code,
          name: ph.name,
          isCompleted: ph.isCompleted,
        })),
        createdAt: p.createdAt.toISOString().split("T")[0],
      };
    });
  } catch (error) {
    console.error("Error in getProjectsAction:", error);
    return INITIAL_MOCK_PROJECTS;
  }
}

export async function createProjectAction(data: {
  name: string;
  phases?: ProjectPhase[];
  owner?: string;
  associatedTeam?: string;
  workHours?: string;
  startDate?: string;
  dueDate?: string;
  priority?: string;
  billingType?: string;
  description?: string;
}): Promise<{ success: boolean; project?: Project; error?: string }> {
  try {
    const nextNum = Math.floor(80 + Math.random() * 20);
    const projectCode = `EEDP-${nextNum}`;

    const ownerName = data.owner || "Dhruv Patidar";
    const initials = ownerName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const phasesToCreate =
      data.phases && data.phases.length > 0
        ? data.phases
        : DEFAULT_PROJECT_PHASES;

    const created = await db.project.create({
      data: {
        code: projectCode,
        name: data.name,
        progressPercent: 0,
        ownerName: ownerName,
        ownerInitials: initials,
        ownerAvatarColor: "bg-warning text-warning-foreground",
        status: "ACTIVE",
        totalHours: data.workHours ? `${data.workHours} h` : "00:00 h",
        billableHours: data.billingType === "Non Billable" ? "00:00 h" : "00:00 h",
        nonBillableHours: data.billingType === "Non Billable" ? data.workHours || "01:00 h" : "00:00 h",
        startDate: data.startDate || new Date().toLocaleDateString("en-GB"),
        deadline: data.dueDate || "01/01/2027",
        description: data.description,
        associatedTeam: data.associatedTeam,
        priority: data.priority,
        billingType: data.billingType,
        phases: {
          create: phasesToCreate.map((ph, idx) => ({
            code: ph.code,
            name: ph.name,
            isCompleted: false,
            order: idx,
          })),
        },
      },
      include: {
        phases: true,
      },
    });

    revalidatePath("/projects");

    const formatted: Project = {
      id: created.code || created.id,
      name: created.name,
      progressPercent: 0,
      owner: {
        id: "u-owner",
        name: ownerName,
        initials,
        avatarColor: "bg-warning text-warning-foreground",
      },
      status: "ACTIVE",
      totalHours: created.totalHours,
      billableHours: created.billableHours,
      nonBillableHours: created.nonBillableHours,
      startDate: created.startDate || "",
      deadline: created.deadline || "",
      completedTasksCount: 0,
      totalTasksCount: 0,
      taskProgressPercent: 0,
      completedPhasesCount: 0,
      totalPhasesCount: created.phases.length,
      phases: created.phases.map((ph) => ({
        id: ph.id,
        code: ph.code,
        name: ph.name,
        isCompleted: ph.isCompleted,
      })),
      createdAt: created.createdAt.toISOString().split("T")[0],
    };

    return { success: true, project: formatted };
  } catch (error) {
    console.error("Error in createProjectAction:", error);
    return { success: false, error: "Failed to create project in database." };
  }
}

export async function deleteProjectAction(id: string): Promise<{ success: boolean }> {
  try {
    await db.project.deleteMany({
      where: {
        OR: [{ id }, { code: id }],
      },
    });
    revalidatePath("/projects");
    return { success: true };
  } catch (error) {
    console.error("Error in deleteProjectAction:", error);
    return { success: false };
  }
}

/**
 * ----------------------------------------------------
 * TASKS CRUD ACTIONS
 * ----------------------------------------------------
 */

export async function getTasksAction(): Promise<TaskItem[]> {
  try {
    let dbTasks = await db.projectTask.findMany({
      include: {
        subtasks: true,
        remarks: true,
        activities: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Seed mock tasks if empty
    if (dbTasks.length === 0) {
      for (const t of INITIAL_MOCK_TASKS) {
        await db.projectTask.create({
          data: {
            code: t.code,
            title: t.title,
            phaseCode: t.phaseCode,
            phaseName: t.phaseName,
            status: t.status,
            authorName: t.authorName,
            associatedTeam: t.associatedTeam,
            owner: t.owner,
            workHours: t.workHours,
            startDate: t.startDate,
            dueDate: t.dueDate,
            duration: t.duration,
            completionPercentage: t.completionPercentage || 0,
            recurrence: t.recurrence,
            priority: t.priority,
            tags: t.tags || [],
            reminder: t.reminder,
            billingType: t.billingType,
            description: t.description,
            isWarning: t.isWarning || false,
            subtasks: {
              create: (t.subtasks || []).map((st) => ({
                code: st.code,
                title: st.title,
                status: st.status,
                ownerName: st.ownerName,
                startDate: st.startDate,
                dueDate: st.dueDate,
                completed: st.completed,
                hasLink: st.hasLink || false,
              })),
            },
            remarks: {
              create: (t.remarks || []).map((r) => ({
                authorName: r.authorName,
                authorInitials: r.authorInitials,
                authorAvatarColor: r.authorAvatarColor,
                content: r.content,
              })),
            },
            activities: {
              create: (t.activities || []).map((act) => ({
                userName: act.userName,
                userInitials: act.userInitials || "YK",
                actionText: act.actionText,
              })),
            },
          },
        });
      }

      dbTasks = await db.projectTask.findMany({
        include: { subtasks: true, remarks: true, activities: true },
        orderBy: { createdAt: "desc" },
      });
    }

    return dbTasks.map((t) => ({
      id: t.id,
      code: t.code,
      title: t.title,
      phaseCode: t.phaseCode || "2.1",
      phaseName: t.phaseName || "UI/UX DESIGNING",
      status: t.status as "Open" | "In Progress" | "Closed",
      authorName: t.authorName,
      associatedTeam: t.associatedTeam || undefined,
      owner: t.owner || undefined,
      workHours: t.workHours || undefined,
      startDate: t.startDate || undefined,
      duration: t.duration || undefined,
      completionPercentage: t.completionPercentage,
      recurrence: t.recurrence || undefined,
      dueDate: t.dueDate || undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      priority: t.priority as any,
      tags: t.tags,
      reminder: t.reminder || undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      billingType: t.billingType as any,
      description: t.description || undefined,
      isWarning: t.isWarning,
      subtasks: t.subtasks.map((st) => ({
        id: st.id,
        code: st.code,
        title: st.title,
        status: st.status as "Open" | "In Progress" | "Closed",
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
        authorAvatarColor: r.authorAvatarColor || "bg-primary text-primary-foreground",
        content: r.content,
        createdAt: r.createdAt.toLocaleDateString("en-GB"),
      })),
      activities: t.activities.map((act) => ({
        id: act.id,
        date: act.createdAt.toLocaleDateString("en-GB"),
        time: act.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        userName: act.userName,
        userInitials: act.userInitials,
        actionText: act.actionText,
      })),
      assignees: [
        { id: "u-default", name: t.authorName, initials: "DP", avatarColor: "bg-warning text-warning-foreground" },
      ],
    }));
  } catch (error) {
    console.error("Error in getTasksAction:", error);
    return INITIAL_MOCK_TASKS;
  }
}

export async function updateTaskAction(
  id: string,
  updatedData: Partial<TaskItem>
): Promise<{ success: boolean }> {
  try {
    await db.projectTask.update({
      where: { id },
      data: {
        status: updatedData.status,
        owner: updatedData.owner,
        description: updatedData.description,
        duration: updatedData.duration,
        completionPercentage: updatedData.completionPercentage,
      },
    });
    revalidatePath("/projects");
    return { success: true };
  } catch (error) {
    console.error("Error in updateTaskAction:", error);
    return { success: false };
  }
}

/**
 * ----------------------------------------------------
 * TIME LOGS CRUD ACTIONS
 * ----------------------------------------------------
 */

export async function getTimeLogsAction(): Promise<UserTimeGroup[]> {
  try {
    let dbLogs = await db.projectTimeLog.findMany({
      orderBy: { createdAt: "desc" },
    });

    if (dbLogs.length === 0) {
      for (const group of INITIAL_MOCK_TIME_GROUPS) {
        for (const log of group.timeLogs) {
          await db.projectTimeLog.create({
            data: {
              code: log.code,
              title: log.title,
              project: log.project,
              duration: log.duration,
              timePeriod: log.timePeriod,
              date: log.date,
              billingType: log.billingType,
              remarks: log.remarks,
              userName: group.userName,
              userInitials: group.userInitials,
              avatarColor: group.avatarColor,
            },
          });
        }
      }

      dbLogs = await db.projectTimeLog.findMany({
        orderBy: { createdAt: "desc" },
      });
    }

    // Group logs by user
    const userMap = new Map<string, UserTimeGroup>();

    INITIAL_MOCK_TIME_GROUPS.forEach((g) => {
      userMap.set(g.userName, {
        ...g,
        timeLogs: [],
      });
    });

    dbLogs.forEach((log) => {
      const group = userMap.get(log.userName) || {
        userId: `u-${log.userName}`,
        userName: log.userName,
        userInitials: log.userInitials,
        avatarColor: log.avatarColor || "bg-primary text-primary-foreground",
        dailyLogHours: "05:07 | 01:51 | 03:16",
        isExpanded: true,
        timeLogs: [],
      };

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
      });

      userMap.set(log.userName, group);
    });

    return Array.from(userMap.values());
  } catch (error) {
    console.error("Error in getTimeLogsAction:", error);
    return INITIAL_MOCK_TIME_GROUPS;
  }
}

/**
 * ----------------------------------------------------
 * USERS FETCH ACTION
 * ----------------------------------------------------
 */

export async function getUsersAction(): Promise<ProjectUser[]> {
  try {
    return INITIAL_MOCK_USERS;
  } catch (error) {
    console.error("Error in getUsersAction:", error);
    return INITIAL_MOCK_USERS;
  }
}

/**
 * ----------------------------------------------------
 * OWNER & ASSOCIATED TEAM FETCH ACTION FOR NEW PROJECT
 * ----------------------------------------------------
 */

export async function getOwnersAndTeamsAction(): Promise<{
  owners: { id: string; name: string; email: string; department?: string | null }[];
  teams: string[];
}> {
  try {
    const [users, dbTasks, dbProjects] = await Promise.all([
      db.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
        },
        orderBy: { name: "asc" },
      }),
      db.projectTask.findMany({
        select: { associatedTeam: true },
      }),
      db.project.findMany({
        select: { associatedTeam: true },
      }),
    ]);

    const owners = users.map((u) => ({
      id: u.id,
      name: u.name || u.email.split("@")[0],
      email: u.email,
      department: u.department,
    }));

    // Extract unique team names from DB columns
    const userDepartments = users.map((u) => u.department);
    const taskTeams = dbTasks.map((t) => t.associatedTeam);
    const projectTeams = dbProjects.map((p) => p.associatedTeam);

    const rawTeams = [...userDepartments, ...taskTeams, ...projectTeams];

    const teamsFromDb = Array.from(
      new Set(
        rawTeams.filter(
          (t): t is string => Boolean(t && typeof t === "string" && t.trim().length > 0)
        )
      )
    );

    const defaultTeams = [
      "Engineering",
      "UI/UX Design",
      "Marketing",
      "QA & Testing",
      "Product Management",
    ];

    const teams = Array.from(new Set([...teamsFromDb, ...defaultTeams]));

    return { owners, teams };
  } catch (error) {
    console.error("Error in getOwnersAndTeamsAction:", error);
    return {
      owners: [
        { id: "u-1", name: "Dhruv Patidar", email: "dhruv@winos.com" },
        { id: "u-2", name: "Vaishnavi Shivhare", email: "vaishnavi@winos.com" },
        { id: "u-3", name: "Alex Johnson", email: "alex@winos.com" },
        { id: "u-4", name: "Sarah Miller", email: "sarah@winos.com" },
      ],
      teams: ["Engineering", "UI/UX Design", "Marketing", "QA & Testing"],
    };
  }
}
