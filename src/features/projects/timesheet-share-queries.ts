/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/db";
import { verifyTimesheetShareToken } from "@/lib/timesheet-share-token";
import { verifyProjectEffortShareToken } from "@/lib/project-effort-share-token";
import {
  compareTimeLogsLatestFirst,
  decodeDescriptionWithTimePeriod,
  formatDurationDisplay,
  resolveLogTimePeriod,
  toISTDateString,
} from "./utils/time-helpers";

export interface SharedTimeLog {
  id: string;
  taskCode: string;
  title: string;
  project: string;
  timePeriod: string;
  durationMinutes: number;
  duration: string;
  billingType: "BILLABLE" | "NON BILLABLE";
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  remarks: string;
}

export interface SharedTimesheet {
  userName: string;
  userTitle: string | null;
  date: string;
  expiresAt: Date | null;
  logs: SharedTimeLog[];
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
}

export type SharedTimesheetResult =
  | { status: "ok"; data: SharedTimesheet }
  | { status: "invalid" | "expired" | "inactive" };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Public, unauthenticated read of a shared timesheet. The signed token is the
 * only credential, so this must stay a server-only module (never "use server").
 */
export async function getSharedTimesheet(token: string): Promise<SharedTimesheetResult> {
  const verified = verifyTimesheetShareToken(token);
  if (verified.status !== "ok") return { status: verified.status };
  const share = verified.payload;

  const d = db as any;
  const user = await d.user.findUnique({
    where: { id: share.userId },
    select: { name: true, email: true, title: true, isActive: true },
  });
  // Deactivating a user also kills every link they've shared.
  if (!user?.isActive) return { status: "inactive" };

  // The tracker buckets logs by their IST date, so fetch a padded window and
  // filter the same way to show exactly what the owner saw when sharing.
  const dayStart = new Date(`${share.date}T00:00:00.000Z`);
  const dbLogs = await d.projectTimeLog.findMany({
    where: {
      userId: share.userId,
      date: { gte: new Date(dayStart.getTime() - DAY_MS), lt: new Date(dayStart.getTime() + 2 * DAY_MS) },
    },
    include: {
      project: { select: { name: true } },
      task: { select: { code: true, title: true } },
    },
    orderBy: { date: "asc" },
  });

  const logs: SharedTimeLog[] = dbLogs
    .filter((log: any) => toISTDateString(log.date) === share.date)
    .map((log: any) => {
      const { timePeriod, remarks } = decodeDescriptionWithTimePeriod(log.description);
      const durationMinutes = Number(log.duration) || 0;
      return {
        id: log.id,
        taskCode: log.task?.code || "",
        title: log.task?.title || remarks || "Logged Work",
        project: log.project?.name || "Project",
        timePeriod: resolveLogTimePeriod(timePeriod, durationMinutes, log.createdAt || log.date),
        durationMinutes,
        duration: formatDurationDisplay(durationMinutes),
        billingType: log.billingType === "BILLABLE" ? "BILLABLE" : "NON BILLABLE",
        approvalStatus: log.approvalStatus,
        remarks,
      };
    })
    .sort((a: SharedTimeLog, b: SharedTimeLog) => compareTimeLogsLatestFirst({ date: share.date, ...a }, { date: share.date, ...b }));

  const billableMinutes = logs
    .filter((l) => l.billingType === "BILLABLE")
    .reduce((sum, l) => sum + l.durationMinutes, 0);
  const totalMinutes = logs.reduce((sum, l) => sum + l.durationMinutes, 0);

  return {
    status: "ok",
    data: {
      userName: user.name || user.email,
      userTitle: user.title,
      date: share.date,
      expiresAt: share.expiresAt ? new Date(share.expiresAt) : null,
      logs,
      totalMinutes,
      billableMinutes,
      nonBillableMinutes: totalMinutes - billableMinutes,
    },
  };
}

export interface SharedProjectTimeLog extends SharedTimeLog {
  /** YYYY-MM-DD (IST) */
  date: string;
  member: string;
}

export interface SharedProjectEffortLogs {
  projectName: string;
  projectCode: string;
  from: string;
  to: string;
  /** Only the sharer's own logs (they can't see the rest of the team's). */
  ownOnly: boolean;
  sharedByName: string;
  expiresAt: Date | null;
  /** Latest day first; each day's logs latest first. */
  days: { date: string; totalMinutes: number; logs: SharedProjectTimeLog[] }[];
  logCount: number;
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
}

export type SharedProjectEffortLogsResult =
  | { status: "ok"; data: SharedProjectEffortLogs }
  | { status: "invalid" | "expired" | "inactive" };

/**
 * Public, unauthenticated read of a shared project effort-log report (a project over a date
 * range). The signed token is the only credential — server-only module, never "use server".
 */
export async function getSharedProjectEffortLogs(token: string): Promise<SharedProjectEffortLogsResult> {
  const verified = verifyProjectEffortShareToken(token);
  if (verified.status !== "ok") return { status: verified.status };
  const share = verified.payload;

  const d = db as any;
  const [sharer, project] = await Promise.all([
    d.user.findUnique({ where: { id: share.sharedBy }, select: { name: true, email: true, isActive: true } }),
    d.project.findUnique({ where: { id: share.projectId }, select: { name: true, code: true } }),
  ]);
  // Deactivating the sharer (or deleting the project) kills the link.
  if (!sharer?.isActive || !project) return { status: "inactive" };

  // Logs are bucketed by IST date (as in the tracker), so fetch a padded window and filter.
  const fromStart = new Date(`${share.from}T00:00:00.000Z`);
  const toStart = new Date(`${share.to}T00:00:00.000Z`);
  const dbLogs = await d.projectTimeLog.findMany({
    where: {
      projectId: share.projectId,
      ...(share.scope === "own" ? { userId: share.sharedBy } : {}),
      date: { gte: new Date(fromStart.getTime() - DAY_MS), lt: new Date(toStart.getTime() + 2 * DAY_MS) },
    },
    include: {
      user: { select: { name: true, email: true } },
      task: { select: { code: true, title: true } },
    },
  });

  const logs: SharedProjectTimeLog[] = dbLogs
    .map((log: any) => ({ log, date: toISTDateString(log.date) }))
    .filter(({ date }: { date: string }) => date >= share.from && date <= share.to)
    .map(({ log, date }: { log: any; date: string }) => {
      const { timePeriod, remarks } = decodeDescriptionWithTimePeriod(log.description);
      const durationMinutes = Number(log.duration) || 0;
      return {
        id: log.id,
        date,
        member: log.user?.name || log.user?.email || "Member",
        taskCode: log.task?.code || "",
        title: log.task?.title || remarks || "Logged Work",
        project: project.name,
        timePeriod: resolveLogTimePeriod(timePeriod, durationMinutes, log.createdAt || log.date),
        durationMinutes,
        duration: formatDurationDisplay(durationMinutes),
        billingType: log.billingType === "BILLABLE" ? "BILLABLE" : "NON BILLABLE",
        approvalStatus: log.approvalStatus,
        remarks,
      };
    })
    .sort(compareTimeLogsLatestFirst);

  const byDate = new Map<string, SharedProjectTimeLog[]>();
  for (const log of logs) {
    const bucket = byDate.get(log.date);
    if (bucket) bucket.push(log);
    else byDate.set(log.date, [log]);
  }
  const days = [...byDate.entries()].map(([date, dayLogs]) => ({
    date,
    totalMinutes: dayLogs.reduce((sum, l) => sum + l.durationMinutes, 0),
    logs: dayLogs,
  }));

  const billableMinutes = logs
    .filter((l) => l.billingType === "BILLABLE")
    .reduce((sum, l) => sum + l.durationMinutes, 0);
  const totalMinutes = logs.reduce((sum, l) => sum + l.durationMinutes, 0);

  return {
    status: "ok",
    data: {
      projectName: project.name,
      projectCode: project.code || "",
      from: share.from,
      to: share.to,
      ownOnly: share.scope === "own",
      sharedByName: sharer.name || sharer.email,
      expiresAt: share.expiresAt ? new Date(share.expiresAt) : null,
      days,
      logCount: logs.length,
      totalMinutes,
      billableMinutes,
      nonBillableMinutes: totalMinutes - billableMinutes,
    },
  };
}
