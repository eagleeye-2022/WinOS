/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/db";
import { verifyTimesheetShareToken } from "@/lib/timesheet-share-token";
import {
  decodeDescriptionWithTimePeriod,
  formatDurationDisplay,
  resolveLogTimePeriod,
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

  // The tracker buckets logs by their UTC date string, so fetch a padded window
  // and filter the same way to show exactly what the owner saw when sharing.
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
    .filter((log: any) => new Date(log.date).toISOString().split("T")[0] === share.date)
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
    });

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
