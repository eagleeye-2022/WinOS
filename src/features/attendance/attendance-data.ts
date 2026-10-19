// Server-side loader that joins DailyAttendance, Holiday, LeaveRequest and AttendanceRegularization
// for a set of users over a date range, and resolves every day with `resolveDay`.
// Not a "use server" module — it is imported by the attendance/leave queries and actions.

import { db } from "@/lib/db";
import {
  dateFromKey,
  dateKeyFromUtc,
  istDateKey,
  leaveCoversKey,
  resolveDay,
  type LeaveSpan,
  type ResolvedDay,
} from "./utils";

/** Optional holidays are opt-in per employee, so they stay normal working days here. */
export const MANDATORY_HOLIDAY = { isOptional: false, type: { not: "OPTIONAL" as const } };

type AttendanceRow =Awaited<ReturnType<typeof db.dailyAttendance.findMany>>[number];
type HolidayRow = Awaited<ReturnType<typeof db.holiday.findMany>>[number];
type RegularizationRow = Awaited<ReturnType<typeof db.attendanceRegularization.findMany>>[number];

const leaveInclude = {
  leaveType: true,
  approvalSteps: { include: { approver: true }, orderBy: { stepOrder: "asc" as const } },
} as const;

type LeaveRow = Awaited<
  ReturnType<typeof db.leaveRequest.findMany<{ include: typeof leaveInclude }>>
>[number];

export interface UserDay {
  key: string;
  resolved: ResolvedDay;
  attendance: AttendanceRow | null;
  holiday: HolidayRow | null;
  /** Approved leave first, else pending leave covering the day. */
  leave: LeaveRow | null;
  regularization: RegularizationRow | null;
}

export interface AttendanceRange {
  todayKey: string;
  daysFor(userId: string, keys: string[]): UserDay[];
}

function toSpan(l: LeaveRow): LeaveSpan {
  return {
    fromDate: l.fromDate,
    toDate: l.toDate,
    durationType: l.durationType,
    durationDays: l.durationDays,
    status: l.status,
    isLossOfPay: l.isLossOfPay,
    lopDaysCount: l.lopDaysCount,
  };
}

/** Loads everything needed to resolve `[startKey, endKey]` for the given users in four queries. */
export async function loadAttendanceRange(
  userIds: string[],
  startKey: string,
  endKey: string
): Promise<AttendanceRange> {
  const start = dateFromKey(startKey)!;
  const endExclusive = dateFromKey(endKey)!;
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const [attendances, holidays, leaves, regularizations] = await Promise.all([
    db.dailyAttendance.findMany({
      where: { userId: { in: userIds }, date: { gte: start, lt: endExclusive } },
    }),
    db.holiday.findMany({
      where: { date: { gte: start, lt: endExclusive }, ...MANDATORY_HOLIDAY },
    }),
    db.leaveRequest.findMany({
      where: {
        userId: { in: userIds },
        status: { in: ["APPROVED", "PENDING"] },
        fromDate: { lt: endExclusive },
        toDate: { gte: start },
      },
      include: leaveInclude,
    }),
    db.attendanceRegularization.findMany({
      where: { userId: { in: userIds }, missingDate: { gte: start, lt: endExclusive } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const attMap = new Map<string, AttendanceRow>();
  for (const a of attendances) attMap.set(`${a.userId}|${dateKeyFromUtc(a.date)}`, a);

  const holidayMap = new Map<string, HolidayRow>();
  for (const h of holidays) holidayMap.set(dateKeyFromUtc(h.date), h);

  const leavesByUser = new Map<string, LeaveRow[]>();
  for (const l of leaves) {
    const list = leavesByUser.get(l.userId) ?? [];
    list.push(l);
    leavesByUser.set(l.userId, list);
  }

  // Later rows overwrite earlier ones, so the map holds the latest request per day.
  const regMap = new Map<string, RegularizationRow>();
  for (const r of regularizations) regMap.set(`${r.userId}|${dateKeyFromUtc(r.missingDate)}`, r);

  const todayKey = istDateKey();

  return {
    todayKey,
    daysFor(userId, keys) {
      const userLeaves = leavesByUser.get(userId) ?? [];
      return keys.map((key) => {
        const attendance = attMap.get(`${userId}|${key}`) ?? null;
        const holiday = holidayMap.get(key) ?? null;
        const covering = userLeaves.filter((l) => leaveCoversKey(l, key));
        const approved = covering.filter((l) => l.status === "APPROVED");
        const pending = covering.filter((l) => l.status === "PENDING");
        const regularization = regMap.get(`${userId}|${key}`) ?? null;

        const resolved = resolveDay({
          key,
          todayKey,
          isHoliday: Boolean(holiday),
          attendance: attendance
            ? {
                status: attendance.status,
                checkInTime: attendance.checkInTime,
                checkOutTime: attendance.checkOutTime,
                isLive: attendance.isLive,
              }
            : null,
          approvedLeaves: approved.map(toSpan),
          hasPendingLeave: pending.length > 0,
          regularizationStatus: regularization?.status ?? null,
        });

        return {
          key,
          resolved,
          attendance,
          holiday,
          leave: approved[0] ?? pending[0] ?? null,
          regularization,
        };
      });
    },
  };
}
