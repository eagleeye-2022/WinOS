/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type BillingTypeEnum = "BILLABLE" | "NON_BILLABLE";
export type ApprovalStatusEnum = "PENDING" | "APPROVED" | "REJECTED";

export interface CreateTimeLogParams {
  projectId: string;
  phaseId: string;
  taskId: string;
  date?: string | Date;
  duration: number; // in minutes (> 0)
  billingType?: BillingTypeEnum;
  description?: string;
  remarks?: string;
}

export interface UpdateTimeLogParams {
  id?: string;
  logId?: string;
  projectId?: string;
  phaseId?: string;
  taskId?: string;
  date?: string | Date;
  duration?: number; // in minutes
  billingType?: BillingTypeEnum;
  description?: string;
  remarks?: string;
  approvalStatus?: ApprovalStatusEnum;
}

export interface TimeLogFilterParams {
  phaseId?: string;
  taskId?: string;
  userId?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  approvalStatus?: ApprovalStatusEnum;
  projectId?: string;
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
 * Helper to parse duration string like "01:30" or "90 mins" or "1.5" into minutes number.
 */
function parseDurationStrToMinutes(durationStr: string): number {
  if (!durationStr) return 0;
  const str = durationStr.trim();

  if (str.includes(":")) {
    const parts = str.replace(/[^0-9:]/g, "").split(":");
    const hrs = parseInt(parts[0] || "0", 10);
    const mins = parseInt(parts[1] || "0", 10);
    return hrs * 60 + mins;
  }

  const val = parseFloat(str);
  if (!isNaN(val)) {
    return Math.round(val);
  }

  return 0;
}

/**
 * 1. createTimeLogAction
 */
 
export async function createTimeLogAction(params: CreateTimeLogParams | any, overrideProjectId?: string) {
  const { sessionUser, error } = await getAuthenticatedUser();
  if (error || !sessionUser) {
    return { success: false, error: error || "Unauthorized" };
  }

   
  const d = db as any;

  const rawTaskId = params.taskId || params.taskCode;
  const task = await d.projectTask.findFirst({
    where: { OR: [{ id: rawTaskId }, { code: rawTaskId }] },
    select: { id: true, code: true, title: true, phaseId: true, projectId: true },
  });

  const rawProjectId = params.projectId || overrideProjectId || params.project || task?.projectId;
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
    return { success: false, error: "Project not found" };
  }
  if (!task) {
    return { success: false, error: "Task not found" };
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

  let durationMinutes = 0;
  if (typeof params.duration === "number") {
    durationMinutes = params.duration;
  } else if (typeof params.duration === "string") {
    durationMinutes = parseDurationStrToMinutes(params.duration);
  }

  if (isNaN(durationMinutes) || durationMinutes <= 0) {
    durationMinutes = 60; // default 1 hour if unspecified
  }

  const isManager = sessionUser.role === "MANAGER";
  if (!isManager) {
    const membership = await d.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: sessionUser.id,
        },
      },
    });
    if (!membership) {
      return { success: false, error: "You must be a member of this project to log time" };
    }
  }

  let logDate = new Date();
  if (params.date) {
    const parsedDate = new Date(params.date);
    if (!isNaN(parsedDate.getTime())) {
      logDate = parsedDate;
    }
  }

  let billingType: BillingTypeEnum = "NON_BILLABLE";
  if (params.billingType === "BILLABLE" || params.billingType === "Billable") {
    billingType = "BILLABLE";
  }

  const description = params.description || params.remarks || params.title || null;

  try {
    const newLog = await d.projectTimeLog.create({
      data: {
        projectId: project.id,
        phaseId: phase.id,
        taskId: task.id,
        userId: sessionUser.id,
        date: logDate,
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

    revalidatePath(`/projects/${project.id}/time-tracker`);
    revalidatePath(`/projects/${project.id}/tasks/${task.code}`);
    revalidatePath(`/projects/${project.id}/tasks/${task.id}`);
    revalidatePath(`/projects/${project.id}`);
    revalidatePath(`/projects/time-tracker`);

    return { success: true, data: newLog };
  } catch (err: any) {
    console.error("[createTimeLogAction] error:", err);
    return { success: false, error: err?.message || "Failed to create time log" };
  }
}

/**
 * 2. updateTimeLogAction
 */
 
export async function updateTimeLogAction(logIdOrParams: string | UpdateTimeLogParams | any, updatesParam?: UpdateTimeLogParams | any) {
  const { sessionUser, error } = await getAuthenticatedUser();
  if (error || !sessionUser) {
    return { success: false, error: error || "Unauthorized" };
  }

   
  const d = db as any;

  let targetLogId: string;
  let updates: any;

  if (typeof logIdOrParams === "string") {
    targetLogId = logIdOrParams;
    updates = updatesParam || {};
  } else {
    targetLogId = logIdOrParams.id || logIdOrParams.logId;
    updates = logIdOrParams;
  }

  if (!targetLogId) {
    return { success: false, error: "Time log ID is required" };
  }

  const existingLog = await d.projectTimeLog.findUnique({
    where: { id: targetLogId },
  });

  if (!existingLog) {
    return { success: false, error: "Time log not found" };
  }

  const isManager = sessionUser.role === "MANAGER";

  if (!isManager) {
    if (existingLog.userId !== sessionUser.id) {
      return { success: false, error: "You can only edit your own time logs" };
    }
    if (existingLog.approvalStatus !== "PENDING") {
      return { success: false, error: "You can only edit PENDING time logs" };
    }
  }

  const targetProjectId = updates.projectId || existingLog.projectId;
  const targetPhaseId = updates.phaseId || existingLog.phaseId;
  const targetTaskId = updates.taskId || existingLog.taskId;

  if (updates.projectId || updates.phaseId || updates.taskId) {
    const phase = await d.projectPhase.findFirst({
      where: { id: targetPhaseId, projectId: targetProjectId },
      select: { id: true },
    });
    if (!phase) {
      return { success: false, error: "Phase does not belong to specified project" };
    }

    const task = await d.projectTask.findFirst({
      where: { id: targetTaskId, phaseId: targetPhaseId, projectId: targetProjectId },
      select: { id: true },
    });
    if (!task) {
      return { success: false, error: "Task does not belong to specified phase and project" };
    }
  }

  const dataToUpdate: any = {};

  if (updates.projectId) dataToUpdate.projectId = updates.projectId;
  if (updates.phaseId) dataToUpdate.phaseId = updates.phaseId;
  if (updates.taskId) dataToUpdate.taskId = updates.taskId;

  if (updates.duration !== undefined) {
    let mins = 0;
    if (typeof updates.duration === "number") mins = updates.duration;
    else if (typeof updates.duration === "string") mins = parseDurationStrToMinutes(updates.duration);

    if (isNaN(mins) || mins <= 0) {
      return { success: false, error: "duration must be greater than 0 minutes" };
    }
    dataToUpdate.duration = mins;
  }

  if (updates.date) {
    const parsed = new Date(updates.date);
    if (!isNaN(parsed.getTime())) {
      dataToUpdate.date = parsed;
    }
  }

  if (updates.billingType) {
    dataToUpdate.billingType = updates.billingType === "BILLABLE" || updates.billingType === "Billable" ? "BILLABLE" : "NON_BILLABLE";
  }

  if (updates.description !== undefined || updates.remarks !== undefined) {
    dataToUpdate.description = updates.description ?? updates.remarks;
  }

  if (updates.approvalStatus && isManager) {
    dataToUpdate.approvalStatus = updates.approvalStatus;
  }

  try {
    const updated = await d.projectTimeLog.update({
      where: { id: targetLogId },
      data: dataToUpdate,
      include: {
        project: { select: { id: true, name: true, code: true } },
        phase: { select: { id: true, name: true, code: true } },
        task: { select: { id: true, title: true, code: true } },
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    revalidatePath(`/projects/${updated.projectId}/time-tracker`);
    revalidatePath(`/projects/${updated.projectId}`);
    revalidatePath(`/projects/time-tracker`);

    return { success: true, data: updated };
  } catch (err: any) {
    console.error("[updateTimeLogAction] error:", err);
    return { success: false, error: err?.message || "Failed to update time log" };
  }
}

/**
 * 3. deleteTimeLogAction
 */
export async function deleteTimeLogAction(logId: string) {
  const { sessionUser, error } = await getAuthenticatedUser();
  if (error || !sessionUser) {
    return { success: false, error: error || "Unauthorized" };
  }

   
  const d = db as any;

  const isManager = sessionUser.role === "MANAGER";
  if (!isManager) {
    return { success: false, error: "Only managers can delete time logs" };
  }

  const existingLog = await d.projectTimeLog.findUnique({
    where: { id: logId },
  });

  if (!existingLog) {
    return { success: false, error: "Time log not found" };
  }

  try {
    await d.projectTimeLog.delete({
      where: { id: logId },
    });

    revalidatePath(`/projects/${existingLog.projectId}/time-tracker`);
    revalidatePath(`/projects/${existingLog.projectId}`);
    revalidatePath(`/projects/time-tracker`);

    return { success: true };
  } catch (err: any) {
    console.error("[deleteTimeLogAction] error:", err);
    return { success: false, error: err?.message || "Failed to delete time log" };
  }
}

/**
 * 4. approveTimeLogAction (MANAGER only)
 */
export async function approveTimeLogAction(logId: string) {
  const { sessionUser, error } = await getAuthenticatedUser();
  if (error || !sessionUser) {
    return { success: false, error: error || "Unauthorized" };
  }

  const isManager = sessionUser.role === "MANAGER";
  if (!isManager) {
    return { success: false, error: "Only managers can approve time logs" };
  }

   
  const d = db as any;

  const existing = await d.projectTimeLog.findUnique({
    where: { id: logId },
  });
  if (!existing) {
    return { success: false, error: "Time log not found" };
  }

  try {
    const updated = await d.projectTimeLog.update({
      where: { id: logId },
      data: {
        approvalStatus: "APPROVED",
        rejectionReason: null,
      },
      include: {
        project: { select: { id: true, name: true } },
        phase: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    revalidatePath(`/projects/${updated.projectId}/time-tracker`);
    revalidatePath(`/projects/time-tracker`);

    return { success: true, data: updated };
  } catch (err: any) {
    console.error("[approveTimeLogAction] error:", err);
    return { success: false, error: err?.message || "Failed to approve time log" };
  }
}

/**
 * 5. rejectTimeLogAction (MANAGER only)
 */
export async function rejectTimeLogAction(logId: string, rejectionReason: string) {
  const { sessionUser, error } = await getAuthenticatedUser();
  if (error || !sessionUser) {
    return { success: false, error: error || "Unauthorized" };
  }

  const isManager = sessionUser.role === "MANAGER";
  if (!isManager) {
    return { success: false, error: "Only managers can reject time logs" };
  }

  if (!rejectionReason || !rejectionReason.trim()) {
    return { success: false, error: "Rejection reason is required when rejecting a time log" };
  }

   
  const d = db as any;

  const existing = await d.projectTimeLog.findUnique({
    where: { id: logId },
  });
  if (!existing) {
    return { success: false, error: "Time log not found" };
  }

  try {
    const updated = await d.projectTimeLog.update({
      where: { id: logId },
      data: {
        approvalStatus: "REJECTED",
        rejectionReason: rejectionReason.trim(),
      },
      include: {
        project: { select: { id: true, name: true } },
        phase: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    revalidatePath(`/projects/${updated.projectId}/time-tracker`);
    revalidatePath(`/projects/time-tracker`);

    return { success: true, data: updated };
  } catch (err: any) {
    console.error("[rejectTimeLogAction] error:", err);
    return { success: false, error: err?.message || "Failed to reject time log" };
  }
}

/**
 * 6. getProjectTimeLogsAction
 */
export async function getProjectTimeLogsAction(
  projectId: string,
  filters?: TimeLogFilterParams
) {
  const { sessionUser, error } = await getAuthenticatedUser();
  if (error || !sessionUser) {
    return { success: false, error: error || "Unauthorized", data: [] };
  }

   
  const d = db as any;
  const isManager = sessionUser.role === "MANAGER";

  const whereClause: any = {
    projectId: projectId,
  };

  if (isManager) {
    if (filters?.userId) {
      whereClause.userId = filters.userId;
    }
  } else {
    whereClause.userId = sessionUser.id;
  }

  if (filters?.phaseId) {
    whereClause.phaseId = filters.phaseId;
  }
  if (filters?.taskId) {
    whereClause.taskId = filters.taskId;
  }
  if (filters?.approvalStatus) {
    whereClause.approvalStatus = filters.approvalStatus;
  }
  if (filters?.dateFrom || filters?.dateTo) {
    whereClause.date = {};
    if (filters.dateFrom) whereClause.date.gte = new Date(filters.dateFrom);
    if (filters.dateTo) whereClause.date.lte = new Date(filters.dateTo);
  }

  try {
    const logs = await d.projectTimeLog.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        phase: { select: { id: true, code: true, name: true } },
        task: { select: { id: true, code: true, title: true } },
        project: { select: { id: true, code: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    return { success: true, data: logs };
  } catch (err: any) {
    console.error("[getProjectTimeLogsAction] error:", err);
    return { success: false, error: err?.message || "Failed to fetch project time logs", data: [] };
  }
}

/**
 * 7. getMyTimeLogsAction
 */
export async function getMyTimeLogsAction(filters?: TimeLogFilterParams) {
  const { sessionUser, error } = await getAuthenticatedUser();
  if (error || !sessionUser) {
    return { success: false, error: error || "Unauthorized", data: [] };
  }

   
  const d = db as any;

  const whereClause: any = {
    userId: sessionUser.id,
  };

  if (filters?.projectId) {
    whereClause.projectId = filters.projectId;
  }
  if (filters?.approvalStatus) {
    whereClause.approvalStatus = filters.approvalStatus;
  }
  if (filters?.dateFrom || filters?.dateTo) {
    whereClause.date = {};
    if (filters.dateFrom) whereClause.date.gte = new Date(filters.dateFrom);
    if (filters.dateTo) whereClause.date.lte = new Date(filters.dateTo);
  }

  try {
    const logs = await d.projectTimeLog.findMany({
      where: whereClause,
      include: {
        project: { select: { id: true, code: true, name: true } },
        phase: { select: { id: true, code: true, name: true } },
        task: { select: { id: true, code: true, title: true } },
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { date: "desc" },
    });

    return { success: true, data: logs };
  } catch (err: any) {
    console.error("[getMyTimeLogsAction] error:", err);
    return { success: false, error: err?.message || "Failed to fetch my time logs", data: [] };
  }
}
