"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { loadAttendanceRange, type UserDay } from "../attendance-data";
import {
  addDaysToKey,
  canManageAttendance,
  dateFromKey,
  dateKeyFromUtc,
  DAY_NAMES,
  formatClock,
  formatLongDate,
  formatShortDate,
  formatWorkedDuration,
  FULL_DAY_NAMES,
  istDateKey,
  MONTH_NAMES,
  monthKeys,
  netHours,
  rollupMonth,
  shiftDiff,
  SHIFT_END,
  SHIFT_START,
  weekKeysFor,
  workedMinutesBetween,
} from "../utils";
import type {
  AttendanceRecord,
  ActionRequiredItem,
  MonthlySummary,
  TeamMemberAttendance,
  RegularizationRequest,
  RegularizationStatus,
  WorkMode,
  AttendanceSource,
  ShiftSummaryItem,
  TeamPayrollItem,
  MyMonthlyPayrollItem,
  LeavePayrollRecord,
} from "../types";

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session as typeof session & { user: NonNullable<typeof session.user> & { id: string } };
}

async function requireManager() {
  const session = await requireSession();
  if (!canManageAttendance(session.user)) throw new Error("Forbidden");
  return session;
}

function currentMonth(): { monthIndex: number; year: number } {
  const d = dateFromKey(istDateKey())!;
  return { monthIndex: d.getUTCMonth(), year: d.getUTCFullYear() };
}

function workedMinutesOf(day: UserDay): number {
  const att = day.attendance;
  if (!att) return 0;
  if (att.isLive && att.liveSince && day.key === istDateKey()) {
    return att.workedMinutes + Math.max(0, Math.floor((Date.now() - att.liveSince.getTime()) / 60_000));
  }
  return att.workedMinutes || workedMinutesBetween(att.checkInTime, att.checkOutTime) || 0;
}

function formatAppliedDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

// ── 1. GET MY ATTENDANCE DATA ────────────────────────────────────────────────

function toAttendanceRecord(day: UserDay): AttendanceRecord {
  const { key, attendance: att, holiday, leave, resolved } = day;
  const d = dateFromKey(key)!;
  const formattedDate = formatLongDate(key);
  const minutes = workedMinutesOf(day);

  // Step 1 is the applicant; the reviewer is the first non-applicant step that was actioned.
  const reviewStep = leave?.approvalSteps.find((s) => s.approverRole !== "Applicant" && s.status !== "PENDING");

  return {
    id: att?.id || `att-${key}`,
    date: key,
    dayOfWeek: DAY_NAMES[d.getUTCDay()],
    formattedDate,
    status: resolved.status,
    checkInTime: att?.checkInTime || undefined,
    checkOutTime: att?.checkOutTime || undefined,
    checkInSource: (att?.checkInSource as AttendanceSource) || undefined,
    checkOutSource: (att?.checkOutSource as AttendanceSource) || undefined,
    checkInLocation: att?.checkInLocationName
      ? { name: att.checkInLocationName, address: att.checkInAddress || "" }
      : undefined,
    checkOutLocation: att?.checkOutLocationName
      ? { name: att.checkOutLocationName, address: att.checkOutAddress || "" }
      : undefined,
    checkInPhoto: att?.checkInPhoto || undefined,
    checkOutPhoto: att?.checkOutPhoto || undefined,
    workMode: (att?.workMode as WorkMode) || "OFFICE",
    workedDuration: formatWorkedDuration(minutes),
    isLive: resolved.status === "WORKING_NOW",
    liveSince: resolved.status === "WORKING_NOW" && att?.liveSince ? att.liveSince.toISOString() : undefined,
    actionRequiredType: resolved.action?.type,
    actionRequiredReason: resolved.action?.issue ?? resolved.note,
    leaveInfo: leave
      ? {
          leaveType: leave.leaveType.name,
          duration: leave.durationType === "FULL_DAY" ? "Full Day" : "Half Day",
          session:
            leave.halfDayType === "FIRST_HALF"
              ? "First Half"
              : leave.halfDayType === "SECOND_HALF"
              ? "Second Half"
              : undefined,
          status: leave.status as "APPROVED" | "PENDING" | "REJECTED",
          appliedOn: formatAppliedDate(leave.createdAt),
          approvedBy:
            reviewStep?.status === "APPROVED"
              ? {
                  name: reviewStep.approver?.name || reviewStep.approverName || "Manager",
                  role: reviewStep.approver?.title || reviewStep.approverRole || "Manager",
                  avatarUrl: reviewStep.approver?.image || undefined,
                }
              : undefined,
        }
      : undefined,
    holidayInfo: holiday
      ? {
          name: holiday.name,
          type: holiday.type === "PUBLIC" ? "National Holiday" : "Company Holiday",
          countryFlag: "🇮🇳",
          dateFormatted: formattedDate,
        }
      : undefined,
    compensatoryWork:
      (resolved.status === "HOLIDAY" || resolved.status === "WEEKEND") && att?.checkInTime
        ? { isHolidayWork: true, canRequestCompOff: true, holidayName: holiday?.name }
        : undefined,
  };
}

/**
 * Month calendar for the signed-in user, or — for managers — for `forUserId`.
 * Records are padded to whole Mon–Sun weeks so week and month views can render edge days;
 * the summary and action items only cover the requested month.
 */
export async function getMyAttendanceData(monthIndex?: number, year?: number, forUserId?: string) {
  const session = await requireSession();
  let userId = session.user.id!;
  if (forUserId && forUserId !== userId) {
    if (!canManageAttendance(session.user)) throw new Error("Forbidden");
    userId = forUserId;
  }

  const fallback = currentMonth();
  const m = monthIndex ?? fallback.monthIndex;
  const y = year ?? fallback.year;

  const inMonth = monthKeys(m, y);
  const firstWeek = weekKeysFor(inMonth[0]);
  const lastWeek = weekKeysFor(inMonth[inMonth.length - 1]);
  const keys: string[] = [];
  for (let k = firstWeek[0]; k <= lastWeek[6]; k = addDaysToKey(k, 1)) keys.push(k);

  const range = await loadAttendanceRange([userId], keys[0], keys[keys.length - 1]);
  const days = range.daysFor(userId, keys);
  const monthSet = new Set(inMonth);
  const monthDays = days.filter((d) => monthSet.has(d.key));

  const records = days.map(toAttendanceRecord);

  const actionRequired: ActionRequiredItem[] = monthDays
    .filter((d) => d.resolved.action)
    .map((d) => ({
      id: `act-${d.key}`,
      date: d.key,
      formattedDate: formatLongDate(d.key),
      dayName: FULL_DAY_NAMES[dateFromKey(d.key)!.getUTCDay()],
      issue: d.resolved.action!.issue,
    }));

  const rollup = rollupMonth(monthDays.map((d) => d.resolved));
  const summary: MonthlySummary = {
    month: `${MONTH_NAMES[m]} ${y}`,
    totalWorkingDays: rollup.companyWorkingDays,
    presentDays: Math.round(monthDays.reduce((acc, d) => acc + d.resolved.present, 0) * 100) / 100,
    leavesTaken: Math.round((rollup.paidOffs + rollup.lossOfPay) * 100) / 100,
    absentDays: rollup.absentDays,
  };

  const liveRecord = records.find((r) => r.date === range.todayKey);

  return { records, actionRequired, summary, liveRecord, todayKey: range.todayKey };
}

// ── 2. GET TEAM ATTENDANCE DATA ──────────────────────────────────────────────

// Internal staff only — project clients never have attendance. profileRole is nullable, so match nulls explicitly.
const TEAM_USERS_WHERE = {
  isActive: true,
  OR: [{ profileRole: null }, { profileRole: { not: "CLIENT" as const } }],
};

const teamUserSelect = {
  id: true,
  name: true,
  employeeId: true,
  title: true,
  department: true,
  image: true,
  email: true,
} as const;

export async function getTeamAttendanceData(
  selectedDateStr?: string,
  filters?: { search?: string; status?: string; workMode?: string }
) {
  await requireManager();

  const key = selectedDateStr && dateFromKey(selectedDateStr) ? selectedDateStr : istDateKey();

  const users = await db.user.findMany({
    where: TEAM_USERS_WHERE,
    select: teamUserSelect,
    orderBy: { name: "asc" },
  });

  const range = await loadAttendanceRange(users.map((u) => u.id), key, key);

  const teamMembers: TeamMemberAttendance[] = users.map((u) => {
    const [day] = range.daysFor(u.id, [key]);
    const att = day.attendance;
    const approvedLeave = day.leave?.status === "APPROVED" ? day.leave : null;

    let status: TeamMemberAttendance["status"] = "Absent";
    if (day.resolved.status === "WORKING_NOW") status = "Working Now";
    else if (att?.checkInTime) status = "Completed";
    else if (approvedLeave) status = "On Leave";

    const minutes = workedMinutesOf(day);

    return {
      id: u.id,
      employeeId: u.employeeId || `EMP-${u.id.slice(-4).toUpperCase()}`,
      name: u.name || "Team Member",
      avatarUrl: u.image || undefined,
      designation: u.title || "Team Member",
      department: u.department || "—",
      email: u.email,
      status,
      leaveType: approvedLeave?.leaveType.name,
      checkInTime: att?.checkInTime || undefined,
      checkInSource: (att?.checkInSource as AttendanceSource) || undefined,
      checkOutTime: att?.checkOutTime || undefined,
      checkOutSource: (att?.checkOutSource as AttendanceSource) || undefined,
      workedHours: minutes > 0 ? formatClock(minutes) : undefined,
      workedHoursSubtext: status === "Working Now" && att?.checkInTime ? `Since ${att.checkInTime}` : undefined,
      workMode: (att?.workMode === "REMOTE" ? "Remote" : "Office") as "Office" | "Remote",
    };
  });

  let filtered = teamMembers;
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.employeeId.toLowerCase().includes(q) ||
        m.designation.toLowerCase().includes(q)
    );
  }
  if (filters?.status && filters.status !== "All Status") {
    filtered = filtered.filter((m) => m.status === filters.status);
  }
  if (filters?.workMode && filters.workMode !== "All Modes") {
    filtered = filtered.filter((m) => m.workMode === filters.workMode);
  }

  const counts = {
    total: teamMembers.length,
    workingNow: teamMembers.filter((m) => m.status === "Working Now").length,
    completed: teamMembers.filter((m) => m.status === "Completed").length,
    onLeave: teamMembers.filter((m) => m.status === "On Leave").length,
    absent: teamMembers.filter((m) => m.status === "Absent").length,
  };

  return { teamMembers: filtered, counts };
}

// ── 3/4. REGULARIZATION REQUESTS ─────────────────────────────────────────────

const regularizationInclude = { user: true, reviewedBy: true } as const;
type RegularizationWithUsers = Awaited<
  ReturnType<typeof db.attendanceRegularization.findMany<{ include: typeof regularizationInclude }>>
>[number];

const STATUS_LABEL: Record<string, RegularizationStatus> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

function toRegularizationRequest(r: RegularizationWithUsers): RegularizationRequest {
  const key = dateKeyFromUtc(r.missingDate);
  const applied = r.createdAt;
  const appliedOnStr = formatAppliedDate(applied);
  const appliedTime = applied.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
  const appliedDay = applied.toLocaleDateString("en-US", { weekday: "long", timeZone: "Asia/Kolkata" });

  return {
    id: r.id,
    employee: {
      id: r.user.id,
      employeeId: r.user.employeeId || `EMP-${r.user.id.slice(-4).toUpperCase()}`,
      name: r.user.name || "Employee",
      avatarUrl: r.user.image || undefined,
      status: r.user.isActive ? "ACTIVE" : "INACTIVE",
      designation: r.user.title || "Team Member",
      department: r.user.department || "—",
      email: r.user.email,
      phone: r.user.workMobile || r.user.personalMobile || "—",
    },
    attendanceDate: formatShortDate(key),
    attendanceDay: FULL_DAY_NAMES[r.missingDate.getUTCDay()],
    existingAttendance: {
      checkIn: r.existingCheckIn || "--:--",
      checkOut: r.existingCheckOut || "--:--",
      workedDuration: formatWorkedDuration(workedMinutesBetween(r.existingCheckIn, r.existingCheckOut)) || "--",
    },
    requestedAttendance: {
      checkIn: r.checkInTime,
      checkOut: r.checkOutTime,
      workedDuration: formatWorkedDuration(workedMinutesBetween(r.checkInTime, r.checkOutTime)) || "--",
    },
    reason: r.reason,
    remarks: r.remarks || undefined,
    status: STATUS_LABEL[r.status] || "Pending",
    requestedOn: `${appliedOnStr}, ${appliedTime}`,
    appliedOn: appliedOnStr,
    appliedDay,
    timeline: [
      {
        title: "Request Submitted",
        subtitle: `Submitted by ${r.user.name || "Employee"}`,
        timestamp: appliedOnStr,
        status: "completed",
      },
      {
        title: "Manager Review",
        subtitle:
          r.status === "PENDING"
            ? "Pending review by Reporting Manager"
            : r.status === "APPROVED"
            ? `Approved by ${r.reviewedBy?.name || "Manager"}`
            : `Rejected by ${r.reviewedBy?.name || "Manager"}${r.rejectionReason ? `: ${r.rejectionReason}` : ""}`,
        timestamp: r.reviewedAt ? formatAppliedDate(r.reviewedAt) : undefined,
        status: r.status === "PENDING" ? "current" : "completed",
      },
      {
        title: "Attendance Updated",
        subtitle: r.status === "APPROVED" ? "Daily attendance record updated" : "No updates made",
        status: r.status === "APPROVED" ? "completed" : "upcoming",
      },
    ],
  };
}

export async function getRegularizationRequestsData(filters?: { status?: string; search?: string }) {
  const session = await requireSession();
  const isManager = canManageAttendance(session.user);

  const raw = await db.attendanceRegularization.findMany({
    where: isManager ? {} : { userId: session.user.id },
    include: regularizationInclude,
    orderBy: { createdAt: "desc" },
  });

  const requests = raw.map(toRegularizationRequest);

  let filtered = requests;
  if (filters?.status && filters.status !== "All") {
    filtered = filtered.filter((r) => r.status.toLowerCase() === filters.status?.toLowerCase());
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.employee.name.toLowerCase().includes(q) ||
        r.employee.employeeId.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
    );
  }

  const counts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === "Pending").length,
    approved: requests.filter((r) => r.status === "Approved").length,
    rejected: requests.filter((r) => r.status === "Rejected").length,
  };

  return { requests: filtered, counts, canReview: isManager, currentUserId: session.user.id };
}

export async function getRegularizationRequestById(id: string) {
  const session = await requireSession();

  const r = await db.attendanceRegularization.findUnique({
    where: { id },
    include: regularizationInclude,
  });
  if (!r) return null;
  if (r.userId !== session.user.id && !canManageAttendance(session.user)) return null;

  return toRegularizationRequest(r);
}

// ── 5. GET MY SHIFT SUMMARY DATA ─────────────────────────────────────────────

function toShiftItem(day: UserDay, base: Partial<ShiftSummaryItem> & { id: string }): ShiftSummaryItem {
  const { resolved, attendance: att } = day;

  if (!resolved.isWorkingDay) {
    return { ...base, status: "Weekend", workMode: "Weekend" };
  }
  if (att?.checkInTime) {
    const minutes = workedMinutesOf(day);
    return {
      ...base,
      status: "Present",
      attendanceTime: `${att.checkInTime} → ${att.checkOutTime || "Working"}`,
      totalHours: minutes > 0 ? formatClock(minutes) : undefined,
      checkInDiff: shiftDiff(att.checkInTime, SHIFT_START),
      checkOutDiff: att.checkOutTime ? shiftDiff(att.checkOutTime, SHIFT_END) : undefined,
      netHours: att.checkOutTime && minutes > 0 ? netHours(minutes) : undefined,
      workMode: att.workMode === "REMOTE" ? "Remote" : "Office",
    };
  }
  if (resolved.status === "ON_LEAVE" && day.leave?.status === "APPROVED") {
    return { ...base, status: "On Leave", workMode: "Office" };
  }
  return { ...base, status: "Absent", workMode: "Office" };
}

export async function getMyShiftSummaryData(monthIndex?: number, year?: number) {
  const session = await requireSession();
  const userId = session.user.id!;

  const fallback = currentMonth();
  const m = monthIndex ?? fallback.monthIndex;
  const y = year ?? fallback.year;

  // Only up to today — future days have nothing to summarise.
  const keys = monthKeys(m, y).filter((k) => k <= istDateKey());
  if (keys.length === 0) return [];

  const range = await loadAttendanceRange([userId], keys[0], keys[keys.length - 1]);

  return range.daysFor(userId, keys).map((day) => {
    const d = dateFromKey(day.key)!;
    const dateStr = `${String(d.getUTCDate()).padStart(2, "0")}/${String(m + 1).padStart(2, "0")}/${y} ${
      DAY_NAMES[d.getUTCDay()].charAt(0) + DAY_NAMES[d.getUTCDay()].slice(1).toLowerCase()
    }`;
    return toShiftItem(day, { id: day.attendance?.id || `shift-${day.key}`, dateStr });
  });
}

// ── 6. GET TEAM SHIFT SUMMARY DATA ───────────────────────────────────────────

export async function getTeamShiftSummaryData(selectedDateStr?: string) {
  await requireManager();

  const key = selectedDateStr && dateFromKey(selectedDateStr) ? selectedDateStr : istDateKey();

  const users = await db.user.findMany({
    where: TEAM_USERS_WHERE,
    select: teamUserSelect,
    orderBy: { name: "asc" },
  });
  const range = await loadAttendanceRange(users.map((u) => u.id), key, key);

  return users.map((u) => {
    const [day] = range.daysFor(u.id, [key]);
    return toShiftItem(day, {
      id: u.id,
      employeeName: u.name || "Employee",
      designation: u.title || "Team Member",
      avatarUrl: u.image || undefined,
    });
  });
}

// ── 7/8/9. PAYROLL ───────────────────────────────────────────────────────────

/** Working-day roll-ups only count days up to today, so a running month isn't full of absences. */
function payrollKeys(monthIndex: number, year: number): { all: string[]; elapsed: string[] } {
  const all = monthKeys(monthIndex, year);
  const today = istDateKey();
  return { all, elapsed: all.filter((k) => k <= today) };
}

export async function getMyPayrollReportData(year?: number) {
  const session = await requireSession();
  const userId = session.user.id!;
  const y = year ?? currentMonth().year;

  const range = await loadAttendanceRange([userId], `${y}-01-01`, `${y}-12-31`);
  const monthsList: MyMonthlyPayrollItem[] = [];

  for (let m = 0; m < 12; m++) {
    const { all, elapsed } = payrollKeys(m, y);
    if (elapsed.length === 0) continue;

    const expected = rollupMonth(range.daysFor(userId, all).map((d) => d.resolved)).companyWorkingDays;
    const r = rollupMonth(range.daysFor(userId, elapsed).map((d) => d.resolved));

    monthsList.push({
      id: `mp-${y}-${m}`,
      month: `${MONTH_NAMES[m].slice(0, 3)} ${y}`,
      companyWorkingDays: expected,
      expectedPayableDays: expected,
      presentDays: r.presentDays,
      halfDays: r.halfDays,
      paidOffs: r.paidOffs,
      absentDays: Math.round((r.absentDays + r.lossOfPay) * 100) / 100,
      totalDays: r.paidDays,
    });
  }

  return monthsList.reverse();
}

export async function getTeamPayrollReportData(monthIndex?: number, year?: number) {
  await requireManager();
  const fallback = currentMonth();
  const m = monthIndex ?? fallback.monthIndex;
  const y = year ?? fallback.year;
  const { all, elapsed } = payrollKeys(m, y);

  const users = await db.user.findMany({
    where: TEAM_USERS_WHERE,
    select: teamUserSelect,
    orderBy: { name: "asc" },
  });
  const range = await loadAttendanceRange(users.map((u) => u.id), all[0], all[all.length - 1]);

  return users.map((u): TeamPayrollItem => {
    const expected = rollupMonth(range.daysFor(u.id, all).map((d) => d.resolved)).companyWorkingDays;
    const r = rollupMonth(range.daysFor(u.id, elapsed).map((d) => d.resolved));
    return {
      id: u.id,
      name: u.name || "Employee",
      designation: u.title || "Team Member",
      avatarUrl: u.image || undefined,
      companyWorkingDays: expected,
      expectedPayableDays: expected,
      presentDays: r.presentDays,
      halfDays: r.halfDays,
      paidOffs: r.paidOffs,
      absentDays: Math.round((r.absentDays + r.lossOfPay) * 100) / 100,
      totalDays: r.paidDays,
    };
  });
}

export async function getTeamLeavePayrollData(monthIndex?: number, year?: number) {
  await requireManager();
  const fallback = currentMonth();
  const m = monthIndex ?? fallback.monthIndex;
  const y = year ?? fallback.year;
  const { all, elapsed } = payrollKeys(m, y);

  const users = await db.user.findMany({
    where: TEAM_USERS_WHERE,
    select: teamUserSelect,
    orderBy: { name: "asc" },
  });
  const range = await loadAttendanceRange(users.map((u) => u.id), all[0], all[all.length - 1]);

  return users.map((u): LeavePayrollRecord => {
    const monthDays = range.daysFor(u.id, all);
    const nonWorking = monthDays.filter((d) => !d.resolved.isWorkingDay).length;
    const payableDays = all.length - nonWorking;

    // LOP comes from approved unpaid leave across the whole month (future leave is already booked),
    // plus unexplained absences on days that have passed.
    let unpaidLeave = 0;
    let halfDayUnpaid = 0;
    for (const d of monthDays) {
      if (d.resolved.lopLeave <= 0) continue;
      if (d.resolved.lopLeave < 1) halfDayUnpaid += d.resolved.lopLeave;
      else unpaidLeave += d.resolved.lopLeave;
    }
    const elapsedSet = new Set(elapsed);
    const unexplainedAbsence = monthDays
      .filter((d) => elapsedSet.has(d.key))
      .reduce((acc, d) => acc + d.resolved.absent, 0);

    const lossOfPay = Math.round((unpaidLeave + halfDayUnpaid + unexplainedAbsence) * 100) / 100;

    return {
      id: u.id,
      name: u.name || "Employee",
      avatarGradient: "from-blue-500 to-indigo-600",
      totalDays: all.length,
      weekend: nonWorking,
      payableDays,
      lossOfPay,
      paidDays: Math.max(0, Math.round((payableDays - lossOfPay) * 100) / 100),
      lossOfPayBreakdown: {
        unpaidLeave: Math.round((unpaidLeave + unexplainedAbsence) * 100) / 100,
        halfDayUnpaid: Math.round(halfDayUnpaid * 100) / 100,
        lateArrival: 0,
      },
    };
  });
}

// ── 10. GET MY PROFILE DATA ──────────────────────────────────────────────────

export async function getMyProfileData() {
  const session = await requireSession();

  return db.user.findUnique({
    where: { id: session.user.id },
    include: {
      reportingTo: true,
      secondaryReportingTo: true,
    },
  });
}
