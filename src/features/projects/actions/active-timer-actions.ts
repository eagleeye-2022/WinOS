/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type BillingTypeEnum = "BILLABLE" | "NON_BILLABLE";

export interface StartActiveTimerParams {
  taskId: string; // CUID or task code like "EEDP-1-T02"
  projectId?: string;
  phaseId?: string;
  description?: string;
  billingType?: BillingTypeEnum;
}

export interface StopActiveTimerParams {
  description?: string;
  billingType?: BillingTypeEnum;
}

/**
 * Re-queries the active user from the database given the current Auth session.
 */
async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return { session: null, sessionUser: null, error: "Unauthorized" };
  }

  const d = db as any;
  const sessionUser = await d.user.findFirst({
    where: {
      OR: [
        { id: session.user.id },
        ...(session.user.email ? [{ email: session.user.email }] : []),
      ],
    },
    select: {
      id: true,
      email: true,
      role: true,
      profileRole: true,
      name: true,
    },
  });

  if (!sessionUser) {
    return {
      session: null,
      sessionUser: null,
      error: "Your session is no longer valid. Please sign out and sign back in.",
    };
  }

  return { session, sessionUser, error: null };
}

/**
 * Whether a user can see other team members' active timers — mirrors the same
 * TEAM_MEMBER|MANAGER (+ ADMIN profile role) check used in project-actions.ts.
 */
function isPrivilegedViewer(user: { role?: string | null; profileRole?: string | null } | null): boolean {
  if (!user) return false;
  const roleStr = String(user.role || "").toUpperCase();
  return (
    roleStr === "ADMIN" ||
    roleStr === "SUPER_ADMIN" ||
    roleStr === "PROJECT_MANAGER" ||
    roleStr === "MANAGER" ||
    user.profileRole === "ADMIN"
  );
}

function formatTimeSeconds(totalSecs: number): string {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

/**
 * Creates or restarts the ActiveTimer in the database.
 * If the user already has an active timer running, it is deleted first.
 */
export async function createActiveTimerAction(params: StartActiveTimerParams | any) {
  const { sessionUser, error } = await getAuthenticatedUser();
  if (error || !sessionUser) {
    return { success: false, error: error || "Unauthorized" };
  }

  const d = db as any;

  const rawTaskId = params.taskId || params.taskCode;
  if (!rawTaskId) {
    return { success: false, error: "taskId is required to start a timer" };
  }

  const task = await d.projectTask.findFirst({
    where: { OR: [{ id: rawTaskId }, { code: rawTaskId }] },
    select: { id: true, code: true, title: true, phaseId: true, projectId: true },
  });

  if (!task) {
    return { success: false, error: "Task not found" };
  }

  const rawProjectId = params.projectId || params.project || task.projectId;
  let project = await d.project.findFirst({
    where: { OR: [{ id: rawProjectId }, { code: rawProjectId }] },
    select: { id: true, name: true, code: true },
  });

  if (!project && task.projectId) {
    project = await d.project.findUnique({
      where: { id: task.projectId },
      select: { id: true, name: true, code: true },
    });
  }

  if (!project) {
    return { success: false, error: "Project not found" };
  }

  // Resolve Phase
  const phaseId = params.phaseId || task.phaseId;
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

  let billingType: BillingTypeEnum = "NON_BILLABLE";
  if (params.billingType === "BILLABLE" || params.billingType === "Billable" || params.isBillable) {
    billingType = "BILLABLE";
  }

  try {
    // Delete any existing active timer for this user
    await d.activeTimer.deleteMany({
      where: { userId: sessionUser.id },
    });

    // Create new ActiveTimer record with server timestamp (startedAt = now())
    const activeTimer = await d.activeTimer.create({
      data: {
        userId: sessionUser.id,
        projectId: project.id,
        phaseId: phase.id,
        taskId: task.id,
        description: params.description || params.notes || null,
        billingType,
        startedAt: new Date(),
      },
      include: {
        project: { select: { id: true, code: true, name: true } },
        phase: { select: { id: true, code: true, name: true } },
        task: { select: { id: true, code: true, title: true } },
      },
    });

    revalidatePath(`/projects/${project.id}/tasks/${task.code}`);
    revalidatePath(`/projects/${project.id}/tasks/${task.id}`);
    revalidatePath(`/projects/${project.id}`);

    const elapsedSeconds = 0;
    return {
      success: true,
      data: {
        ...activeTimer,
        elapsedSeconds,
        formattedTime: "00:00:00",
      },
    };
  } catch (err: any) {
    console.error("[createActiveTimerAction] error:", err);
    return { success: false, error: err?.message || "Failed to start active timer" };
  }
}

/**
 * Stops the ActiveTimer in the database.
 *  - Calculates duration = now() - startedAt server-side
 *  - Creates ProjectTimeLog automatically
 *  - Deletes the ActiveTimer record
 */
import {
  formatTime12h,
  parseDurationMinutes,
  encodeDescriptionWithTimePeriod,
  calculateMinutesFromTimeRange,
  formatTimePeriodRange,
  parseDateAndTimeToDate,
} from "../utils/time-helpers";

export async function stopActiveTimerAction(params?: StopActiveTimerParams | any) {
  const { sessionUser, error } = await getAuthenticatedUser();
  if (error || !sessionUser) {
    return { success: false, error: error || "Unauthorized" };
  }

  const d = db as any;

  const activeTimer = await d.activeTimer.findUnique({
    where: { userId: sessionUser.id },
    include: {
      project: true,
      phase: true,
      task: true,
    },
  });

  if (!activeTimer) {
    return { success: false, error: "No active timer found" };
  }

  const now = new Date();
  let startedAt = new Date(activeTimer.startedAt);
  let durationMinutes = Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / (1000 * 60)));

  let timePeriodStr = "";
  if (params?.startTime && params?.endTime) {
    const parsedStart = parseDateAndTimeToDate(startedAt, params.startTime);
    const parsedEnd = parseDateAndTimeToDate(now, params.endTime);
    startedAt = parsedStart;
    timePeriodStr = formatTimePeriodRange(params.startTime, params.endTime);
    const rangeMins = calculateMinutesFromTimeRange(params.startTime, params.endTime);
    if (rangeMins && rangeMins > 0) {
      durationMinutes = rangeMins;
    }
  } else if (durationMinutes <= 720) {
    timePeriodStr = `${formatTime12h(startedAt)} – ${formatTime12h(now)}`;
  }

  if (params?.duration) {
    const parsed = parseDurationMinutes(params.duration);
    if (parsed > 0) {
      durationMinutes = parsed;
    }
  }

  let billingType: BillingTypeEnum = activeTimer.billingType;
  if (params?.billingType === "BILLABLE" || params?.billingType === "Billable" || params?.isBillable) {
    billingType = "BILLABLE";
  }

  const rawNotes = params?.description || params?.notes || activeTimer.description || `Logged from live timer for ${activeTimer.task?.code || activeTimer.taskId}`;

  if (durationMinutes > 720) {
    timePeriodStr = "";
  }

  const description = encodeDescriptionWithTimePeriod(rawNotes, timePeriodStr);

  try {
    // 1. Create ProjectTimeLog automatically
    const newLog = await d.projectTimeLog.create({
      data: {
        projectId: activeTimer.projectId,
        phaseId: activeTimer.phaseId,
        taskId: activeTimer.taskId,
        userId: sessionUser.id,
        date: startedAt,
        duration: durationMinutes,
        billingType,
        approvalStatus: "PENDING",
        description,
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        phase: { select: { id: true, name: true, code: true } },
        task: { select: { id: true, title: true, code: true } },
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    // 2. Delete ActiveTimer record
    await d.activeTimer.delete({
      where: { id: activeTimer.id },
    });

    revalidatePath(`/projects/${activeTimer.projectId}/time-tracker`);
    if (activeTimer.task?.code) {
      revalidatePath(`/projects/${activeTimer.projectId}/tasks/${activeTimer.task.code}`);
    }
    revalidatePath(`/projects/${activeTimer.projectId}/tasks/${activeTimer.taskId}`);
    revalidatePath(`/projects/${activeTimer.projectId}`);
    revalidatePath(`/projects/time-tracker`);

    return {
      success: true,
      data: newLog,
      durationMinutes,
      elapsedSeconds: Math.floor((now.getTime() - startedAt.getTime()) / 1000),
    };
  } catch (err: any) {
    console.error("[stopActiveTimerAction] error:", err);
    return { success: false, error: err?.message || "Failed to stop active timer" };
  }
}

/**
 * Gets the current user's active timer from the database.
 * Returns null if no timer is currently active.
 * If active timer exists, calculates elapsed = now() - startedAt.
 */
export async function getActiveTimerAction() {
  const { sessionUser, error } = await getAuthenticatedUser();
  if (error || !sessionUser) {
    return { success: false, error: error || "Unauthorized", data: null };
  }

   
  const d = db as any;

  try {
    const activeTimer = await d.activeTimer.findUnique({
      where: { userId: sessionUser.id },
      include: {
        project: { select: { id: true, code: true, name: true } },
        phase: { select: { id: true, code: true, name: true } },
        task: { select: { id: true, code: true, title: true } },
      },
    });

    if (!activeTimer) {
      return { success: true, data: null };
    }

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(activeTimer.startedAt).getTime()) / 1000));
    const formattedTime = formatTimeSeconds(elapsedSeconds);

    return {
      success: true,
      data: {
        ...activeTimer,
        elapsedSeconds,
        formattedTime,
      },
    };
  } catch (err: any) {
    console.error("[getActiveTimerAction] error:", err);
    return { success: false, error: err?.message || "Failed to fetch active timer", data: null };
  }
}

/**
 * Gets all running active timers across team members in the workspace or for a specific project.
 * Useful for Manager / Admin real-time monitoring.
 */
export async function getAllActiveTimersAction(projectId?: string) {
  const { sessionUser, error } = await getAuthenticatedUser();
  if (error || !sessionUser) {
    return { success: false, error: error || "Unauthorized", data: [] };
  }

  const d = db as any;

  try {
    const whereClause: any = {};
    if (projectId) {
      const project = await d.project.findFirst({
        where: { OR: [{ id: projectId }, { code: projectId }] },
        select: { id: true },
      });
      if (project) {
        whereClause.projectId = project.id;
      } else {
        whereClause.projectId = projectId;
      }
    }

    // Team members only ever see their own active timer here; only
    // managers/admins get visibility into everyone else's.
    if (!isPrivilegedViewer(sessionUser)) {
      whereClause.userId = sessionUser.id;
    }

    const activeTimers = await d.activeTimer.findMany({
      where: whereClause,
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
          },
        },
        project: { select: { id: true, code: true, name: true } },
        phase: { select: { id: true, code: true, name: true } },
        task: { select: { id: true, code: true, title: true } },
      },
      orderBy: { startedAt: "desc" },
    });

    const nowMs = Date.now();
    const data = activeTimers.map((timer: any) => {
      const startedAt = new Date(timer.startedAt);
      const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedAt.getTime()) / 1000));
      return {
        ...timer,
        elapsedSeconds,
        formattedTime: formatTimeSeconds(elapsedSeconds),
      };
    });

    return {
      success: true,
      data,
    };
  } catch (err: any) {
    console.error("[getAllActiveTimersAction] error:", err);
    return { success: false, error: err?.message || "Failed to fetch team active timers", data: [] };
  }
}

/**
 * Discards/deletes the current user's active timer record from the database
 * without creating a time log entry.
 */
export async function discardActiveTimerAction() {
  const { sessionUser, error } = await getAuthenticatedUser();
  if (error || !sessionUser) {
    return { success: false, error: error || "Unauthorized" };
  }

  const d = db as any;

  try {
    const deleted = await d.activeTimer.deleteMany({
      where: { userId: sessionUser.id },
    });

    revalidatePath("/projects");
    revalidatePath("/projects/time-tracker");

    return { success: true, count: deleted.count };
  } catch (err: any) {
    console.error("[discardActiveTimerAction] error:", err);
    return { success: false, error: err?.message || "Failed to discard active timer" };
  }
}

