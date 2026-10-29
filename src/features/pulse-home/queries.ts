// Read side of the Pulse home page (/people/home). Not a "use server" module — it is called from the
// page's Server Component. Everything is derived from the same loader as My Attendance / payroll
// (`loadAttendanceRange` → `resolveDay`), so statuses and LOP numbers match those pages.

import { db } from "@/lib/db";
import { loadAttendanceRange, type UserDay } from "@/features/attendance/attendance-data";
import {
  DAY_NAMES,
  FULL_DAY_NAMES,
  addDaysToKey,
  canManageAttendance,
  dateFromKey,
  dateKeyFromUtc,
  formatClock,
  formatLongDate,
  istDateKey,
  workedMinutesBetween,
} from "@/features/attendance/utils";
import type { ActionRequiredItem } from "@/features/attendance/types";
import {
  formatDmy,
  istGreeting,
  presenceLabel,
  previousMonthRange,
  roundDays,
  scheduleDayLabel,
  sundayWeekKeys,
  type DayLabel,
  type DayLabelInput,
} from "./utils";

export interface PulsePerson {
  id: string;
  name: string;
  email: string;
  employeeId: string | null;
  title: string | null;
  image: string | null;
  presence: DayLabel;
}

export interface PulseHomeData {
  greeting: string;
  canManage: boolean;
  me: PulsePerson & { department: string | null };
  today: {
    key: string;
    isLive: boolean;
    checkedIn: boolean;
    checkedOut: boolean;
    workMode: "OFFICE" | "REMOTE";
    /** Minutes already banked today (previous check-in sessions). */
    bankedMinutes: number;
    /** ISO time the current session started, when live. */
    liveSince: string | null;
  };
  manager: PulsePerson | null;
  departmentLabel: string;
  members: PulsePerson[];
  /** e.g. "Thursday, 29 October 2026". */
  todayLabel: string;
  /** Today's attendance in words, e.g. "Checked in at 10:02 AM". */
  todaySummary: string;
  schedule: {
    rangeLabel: string;
    days: {
      key: string;
      dayShort: string;
      dayNum: number;
      isToday: boolean;
      status: DayLabel | null;
      /** Actual check-in / check-out from DailyAttendance ("Now" while still checked in). */
      times: { in: string; out: string } | null;
      hours: string | null;
    }[];
  };
  lossOfPay: {
    rangeLabel: string;
    totalDays: number;
    breakdown: { label: string; days: number }[];
  };
  holidays: { id: string; name: string; dateLabel: string; isOptional: boolean }[];
  absentDays: (ActionRequiredItem & { absentDays: number })[];
}

const personSelect = {
  id: true,
  name: true,
  email: true,
  employeeId: true,
  title: true,
  image: true,
} as const;

// Internal staff only — project clients never have attendance. profileRole is nullable, so match nulls explicitly.
const INTERNAL_ACTIVE = {
  isActive: true,
  OR: [{ profileRole: null }, { profileRole: { not: "CLIENT" as const } }],
};

function labelInput(day: UserDay, todayKey: string): DayLabelInput {
  return {
    key: day.key,
    todayKey,
    resolved: day.resolved,
    checkInTime: day.attendance?.checkInTime ?? null,
    checkOutTime: day.attendance?.checkOutTime ?? null,
    workMode: day.attendance?.workMode ?? null,
    holidayName: day.holiday?.name ?? null,
    leaveStatus: day.leave?.status ?? null,
  };
}

/** Same rule as the attendance queries: banked minutes, plus the running session when live today. */
function workedMinutesOf(day: UserDay, todayKey: string): number {
  const att = day.attendance;
  if (!att) return 0;
  if (att.isLive && att.liveSince && day.key === todayKey) {
    return att.workedMinutes + Math.max(0, Math.floor((Date.now() - att.liveSince.getTime()) / 60_000));
  }
  return att.workedMinutes || workedMinutesBetween(att.checkInTime, att.checkOutTime) || 0;
}

type PersonRow = { id: string; name: string | null; email: string; employeeId: string | null; title: string | null; image: string | null };

function toPerson(u: PersonRow, presence: DayLabel): PulsePerson {
  return {
    id: u.id,
    name: u.name || u.email,
    email: u.email,
    employeeId: u.employeeId,
    title: u.title,
    image: u.image,
    presence,
  };
}

export async function getPulseHomeData(userId: string): Promise<PulseHomeData | null> {
  const me = await db.user.findUnique({
    where: { id: userId },
    select: {
      ...personSelect,
      role: true,
      profileRole: true,
      isActive: true,
      department: true,
      reportingToId: true,
      reportingTo: { select: { ...personSelect, isActive: true } },
    },
  });
  // Re-queried rather than trusting the JWT, so a deleted / deactivated user gets nothing.
  if (!me?.isActive) return null;

  const todayKey = istDateKey();
  const weekKeys = sundayWeekKeys(todayKey);
  const lopRange = previousMonthRange(todayKey);
  const monthStartKey = `${todayKey.slice(0, 7)}-01`;

  // Department colleagues; without a department, fall back to people sharing the same manager.
  const peerWhere = me.department
    ? { department: me.department }
    : me.reportingToId
    ? { reportingToId: me.reportingToId }
    : null;

  const holidayDeptFilter = me.department
    ? { OR: [{ applicableDept: null }, { applicableDept: "" }, { applicableDept: me.department }] }
    : { OR: [{ applicableDept: null }, { applicableDept: "" }] };

  const [peers, holidays, myRange] = await Promise.all([
    peerWhere
      ? db.user.findMany({
          where: { ...INTERNAL_ACTIVE, ...peerWhere, id: { not: me.id } },
          select: personSelect,
          orderBy: { name: "asc" },
        })
      : Promise.resolve([] as PersonRow[]),
    db.holiday.findMany({
      where: { date: { gte: dateFromKey(todayKey)! }, ...holidayDeptFilter },
      orderBy: { date: "asc" },
      take: 3,
    }),
    // One load covers last month (LOP), this month (absent days) and this week (schedule).
    loadAttendanceRange([me.id], lopRange.startKey, weekKeys[6]),
  ]);

  const manager = me.reportingTo?.isActive ? me.reportingTo : null;
  const others = [...(manager ? [manager] : []), ...peers];
  const othersRange = others.length
    ? await loadAttendanceRange(others.map((u) => u.id), todayKey, todayKey)
    : null;
  const presenceOf = (id: string) => {
    const [day] = othersRange!.daysFor(id, [todayKey]);
    return presenceLabel(labelInput(day, todayKey));
  };

  // ── Today ──
  const [todayDay] = myRange.daysFor(me.id, [todayKey]);
  const att = todayDay.attendance;
  const isLive = Boolean(att?.isLive && att.liveSince);

  // ── Work schedule (this week, Sun → Sat) ──
  const scheduleDays = myRange.daysFor(me.id, weekKeys).map((day) => {
    const d = dateFromKey(day.key)!;
    const minutes = day.key <= todayKey ? workedMinutesOf(day, todayKey) : 0;
    const dow = DAY_NAMES[d.getUTCDay()];
    const a = day.attendance;
    const live = Boolean(a?.isLive) && day.key === todayKey;
    return {
      key: day.key,
      dayShort: dow.charAt(0) + dow.slice(1).toLowerCase(),
      dayNum: d.getUTCDate(),
      isToday: day.key === todayKey,
      // Days before joining resolve to a non-working day with no label (see loadAttendanceRange).
      status: scheduleDayLabel(labelInput(day, todayKey)),
      times: a?.checkInTime
        ? { in: a.checkInTime, out: live ? "Now" : a.checkOutTime || "--:--" }
        : null,
      hours: minutes > 0 ? `${formatClock(minutes)} Hrs` : null,
    };
  });

  // ── Loss of pay (last month) — same rule as Team Leave & Payroll: unpaid leave + unexplained absence ──
  const lopKeys: string[] = [];
  for (let k = lopRange.startKey; k <= lopRange.endKey; k = addDaysToKey(k, 1)) lopKeys.push(k);
  const lopByLabel = new Map<string, number>();
  for (const day of myRange.daysFor(me.id, lopKeys)) {
    if (day.resolved.lopLeave > 0) {
      // lopLeave only comes from approved leave, so `day.leave` is that leave.
      const label = day.leave?.leaveType.name ?? "Leave";
      lopByLabel.set(label, (lopByLabel.get(label) ?? 0) + day.resolved.lopLeave);
    }
    if (day.resolved.absent > 0) {
      lopByLabel.set("Absent", (lopByLabel.get("Absent") ?? 0) + day.resolved.absent);
    }
  }
  const breakdown = [...lopByLabel.entries()]
    .map(([label, days]) => ({ label, days: roundDays(days) }))
    .filter((b) => b.days > 0);

  // ── Absent days this month (no check-in, no leave) → "apply leave" prompts ──
  const yesterdayKey = addDaysToKey(todayKey, -1);
  const absentKeys: string[] = [];
  for (let k = monthStartKey; k <= yesterdayKey; k = addDaysToKey(k, 1)) absentKeys.push(k);
  const absentDays = myRange
    .daysFor(me.id, absentKeys)
    .filter((d) => d.resolved.action?.type === "MISSING_BOTH" && !d.attendance?.checkInTime && d.resolved.absent >= 1)
    .map((d) => ({
      id: `absent-${d.key}`,
      date: d.key,
      formattedDate: formatLongDate(d.key),
      dayName: FULL_DAY_NAMES[dateFromKey(d.key)!.getUTCDay()],
      issue: d.resolved.action!.issue,
      absentDays: d.resolved.absent,
    }));

  // ── Today in words, from today's DailyAttendance row ──
  let todaySummary = "Not checked in yet today";
  const where = att?.checkInLocationName ? ` · ${att.checkInLocationName}` : "";
  if (isLive && att?.checkInTime) {
    todaySummary = `${att.workMode === "REMOTE" ? "Working remotely" : "In office"} · checked in at ${att.checkInTime}${where}`;
  } else if (att?.checkInTime && att.checkOutTime) {
    todaySummary = `Checked in at ${att.checkInTime} · checked out at ${att.checkOutTime}${where}`;
  } else if (todayDay.resolved.status === "ON_LEAVE") {
    todaySummary = todayDay.leave
      ? `${todayDay.leave.leaveType.name}${todayDay.leave.status === "PENDING" ? " (pending approval)" : ""}`
      : "On leave today";
  } else if (todayDay.resolved.status === "HOLIDAY") {
    todaySummary = todayDay.holiday?.name || "Holiday";
  } else if (todayDay.resolved.status === "WEEKEND") {
    todaySummary = "Weekend";
  }

  return {
    greeting: istGreeting(),
    canManage: canManageAttendance(me),
    me: { ...toPerson(me, presenceLabel(labelInput(todayDay, todayKey))), department: me.department },
    today: {
      key: todayKey,
      isLive,
      checkedIn: Boolean(att?.checkInTime),
      checkedOut: Boolean(att?.checkOutTime) && !isLive,
      workMode: att?.workMode === "REMOTE" ? "REMOTE" : "OFFICE",
      bankedMinutes: isLive ? att!.workedMinutes : workedMinutesOf(todayDay, todayKey),
      liveSince: isLive ? att!.liveSince!.toISOString() : null,
    },
    manager: manager ? toPerson(manager, presenceOf(manager.id)) : null,
    departmentLabel: me.department ? "Department Members" : "Team Members",
    members: peers.map((p) => toPerson(p, presenceOf(p.id))),
    todayLabel: `${FULL_DAY_NAMES[dateFromKey(todayKey)!.getUTCDay()]}, ${formatLongDate(todayKey)}`,
    todaySummary,
    schedule: {
      rangeLabel: `${formatDmy(weekKeys[0])} - ${formatDmy(weekKeys[6])}`,
      days: scheduleDays,
    },
    lossOfPay: {
      rangeLabel: `${formatDmy(lopRange.startKey)} - ${formatDmy(lopRange.endKey)}`,
      totalDays: roundDays(breakdown.reduce((acc, b) => acc + b.days, 0)),
      breakdown,
    },
    holidays: holidays.map((h) => {
      const key = dateKeyFromUtc(h.date);
      return {
        id: h.id,
        name: h.name,
        dateLabel: `${formatDmy(key)}, ${FULL_DAY_NAMES[dateFromKey(key)!.getUTCDay()]}`,
        isOptional: h.isOptional || h.type === "OPTIONAL",
      };
    }),
    absentDays,
  };
}
