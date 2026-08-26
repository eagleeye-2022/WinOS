import { db } from "@/lib/db";

export interface QueryTimeLogFilters {
  phaseId?: string;
  taskId?: string;
  userId?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
}

/**
 * 1. getTimeLogsByProject
 *  - MANAGER: no userId filter unless passed in filters
 *  - TEAM_MEMBER: filter by userId only
 *  - Group results by phase -> task for display
 *  - Isolation rule: filter by projectId strictly
 */
export async function getTimeLogsByProject(
  projectId: string,
  userId: string,
  role: string,
  filters?: QueryTimeLogFilters
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const isManager = role === "MANAGER";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {
    projectId,
  };

  if (isManager) {
    if (filters?.userId) {
      whereClause.userId = filters.userId;
    }
  } else {
    // TEAM_MEMBER: filter by userId only
    whereClause.userId = userId;
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

  let totalMinutes = 0;
  let billableMinutes = 0;
  let nonBillableMinutes = 0;

  // Map for phase -> task grouping
  const phaseMap = new Map<
    string,
    {
      phase: { id: string; code: string; name: string };
      taskMap: Map<
        string,
        {
          task: { id: string; code: string; title: string };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          logs: any[];
          totalMinutes: number;
          billableMinutes: number;
          nonBillableMinutes: number;
        }
      >;
      totalMinutes: number;
      billableMinutes: number;
      nonBillableMinutes: number;
    }
  >();

   
  for (const log of logs) {
    const duration = typeof log.duration === "number" ? log.duration : 0;
    totalMinutes += duration;
    if (log.billingType === "BILLABLE") billableMinutes += duration;
    else nonBillableMinutes += duration;

    const pId = log.phaseId;
    const tId = log.taskId;

    if (!phaseMap.has(pId)) {
      phaseMap.set(pId, {
        phase: log.phase || { id: pId, code: "", name: "Phase" },
        taskMap: new Map(),
        totalMinutes: 0,
        billableMinutes: 0,
        nonBillableMinutes: 0,
      });
    }

    const pEntry = phaseMap.get(pId)!;
    pEntry.totalMinutes += duration;
    if (log.billingType === "BILLABLE") pEntry.billableMinutes += duration;
    else pEntry.nonBillableMinutes += duration;

    if (!pEntry.taskMap.has(tId)) {
      pEntry.taskMap.set(tId, {
        task: log.task || { id: tId, code: "", title: "Task" },
        logs: [],
        totalMinutes: 0,
        billableMinutes: 0,
        nonBillableMinutes: 0,
      });
    }

    const tEntry = pEntry.taskMap.get(tId)!;
    tEntry.logs.push(log);
    tEntry.totalMinutes += duration;
    if (log.billingType === "BILLABLE") tEntry.billableMinutes += duration;
    else tEntry.nonBillableMinutes += duration;
  }

  const grouped = Array.from(phaseMap.values()).map((p) => ({
    phase: p.phase,
    totalMinutes: p.totalMinutes,
    billableMinutes: p.billableMinutes,
    nonBillableMinutes: p.nonBillableMinutes,
    tasks: Array.from(p.taskMap.values()),
  }));

  return {
    rawLogs: logs,
    grouped,
    summary: {
      totalMinutes,
      billableMinutes,
      nonBillableMinutes,
    },
  };
}

/**
 * 2. getTimeLogsByPhase
 *  - Same role logic
 *  - Used for phase-level summary
 *  - Enforce phase's projectId isolation
 */
export async function getTimeLogsByPhase(
  phaseId: string,
  userId: string,
  role: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const isManager = role === "MANAGER";

  const phase = await d.projectPhase.findUnique({
    where: { id: phaseId },
    select: { id: true, projectId: true },
  });

  if (!phase) {
    return {
      logs: [],
      summary: { totalMinutes: 0, billableMinutes: 0, nonBillableMinutes: 0 },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {
    phaseId: phaseId,
    projectId: phase.projectId, // enforce project isolation
  };

  if (!isManager) {
    whereClause.userId = userId;
  }

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

  let totalMinutes = 0;
  let billableMinutes = 0;
  let nonBillableMinutes = 0;

   
  for (const log of logs) {
    const duration = typeof log.duration === "number" ? log.duration : 0;
    totalMinutes += duration;
    if (log.billingType === "BILLABLE") billableMinutes += duration;
    else nonBillableMinutes += duration;
  }

  return {
    logs,
    summary: {
      totalMinutes,
      billableMinutes,
      nonBillableMinutes,
    },
  };
}

/**
 * 3. getTimeLogsByTask
 *  - Used for task detail drawer
 *  - Enforce task's projectId and phaseId isolation
 */
export async function getTimeLogsByTask(
  taskId: string,
  userId: string,
  role: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const isManager = role === "MANAGER";

  const task = await d.projectTask.findUnique({
    where: { id: taskId },
    select: { id: true, phaseId: true, projectId: true },
  });

  if (!task) {
    return {
      logs: [],
      summary: { totalMinutes: 0, billableMinutes: 0, nonBillableMinutes: 0 },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {
    taskId: taskId,
    ...(task.projectId && { projectId: task.projectId }),
    ...(task.phaseId && { phaseId: task.phaseId }),
  };

  if (!isManager) {
    whereClause.userId = userId;
  }

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

  let totalMinutes = 0;
  let billableMinutes = 0;
  let nonBillableMinutes = 0;

   
  for (const log of logs) {
    const duration = typeof log.duration === "number" ? log.duration : 0;
    totalMinutes += duration;
    if (log.billingType === "BILLABLE") billableMinutes += duration;
    else nonBillableMinutes += duration;
  }

  return {
    logs,
    summary: {
      totalMinutes,
      billableMinutes,
      nonBillableMinutes,
    },
  };
}

/**
 * 4. getMyTimeLogs
 *  - Cross-project view for TEAM_MEMBER
 */
export async function getMyTimeLogs(
  userId: string,
  filters?: QueryTimeLogFilters
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {
    userId,
  };

  if (filters?.approvalStatus) {
    whereClause.approvalStatus = filters.approvalStatus;
  }
  if (filters?.dateFrom || filters?.dateTo) {
    whereClause.date = {};
    if (filters.dateFrom) whereClause.date.gte = new Date(filters.dateFrom);
    if (filters.dateTo) whereClause.date.lte = new Date(filters.dateTo);
  }

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

  return logs;
}

/**
 * 5. getActiveTimerByUser
 *  - Checks DB for active timer for given userId
 *  - Calculates elapsedSeconds = now() - startedAt
 */
export async function getActiveTimerByUser(userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const activeTimer = await d.activeTimer.findUnique({
    where: { userId },
    include: {
      project: { select: { id: true, code: true, name: true } },
      phase: { select: { id: true, code: true, name: true } },
      task: { select: { id: true, code: true, title: true } },
    },
  });

  if (!activeTimer) return null;

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(activeTimer.startedAt).getTime()) / 1000));
  const hrs = Math.floor(elapsedSeconds / 3600);
  const mins = Math.floor((elapsedSeconds % 3600) / 60);
  const secs = elapsedSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  const formattedTime = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;

  return {
    ...activeTimer,
    elapsedSeconds,
    formattedTime,
  };
}
