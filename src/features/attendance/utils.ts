// Pure attendance helpers shared by queries, actions and client components.
// Everything here is IST-based (the team works in India) and DB-free so it can be unit-tested.

import type { ActionRequiredType, AttendanceStatus } from "./types";

// ── Shift configuration ───────────────────────────────────────────────────────

// Configurable per deployment (there is no shift table): NEXT_PUBLIC_ so client components agree.
export const SHIFT_START = process.env.NEXT_PUBLIC_SHIFT_START?.trim() || "09:30 AM";
export const SHIFT_END = process.env.NEXT_PUBLIC_SHIFT_END?.trim() || "06:30 PM";

const IST_OFFSET_MINUTES = 330;

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ── Dates (YYYY-MM-DD keys; DB stores them as UTC midnight) ──────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" of a UTC-midnight Date (how DailyAttendance / LeaveRequest dates are stored). */
export function dateKeyFromUtc(d: Date | string): string {
  const date = new Date(d);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** The calendar day in IST for an instant (defaults to now). */
export function istDateKey(now: Date = new Date()): string {
  return dateKeyFromUtc(new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000));
}

/** "hh:mm AM" wall-clock time in IST for an instant. */
export function istTimeString(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  return formatTime12h(shifted.getUTCHours() * 60 + shifted.getUTCMinutes());
}

/** UTC-midnight Date for a "YYYY-MM-DD" key. Returns null for anything malformed. */
export function dateFromKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return dateKeyFromUtc(d) === key.trim() ? d : null;
}

export function addDaysToKey(key: string, days: number): string {
  const d = dateFromKey(key);
  if (!d) return key;
  d.setUTCDate(d.getUTCDate() + days);
  return dateKeyFromUtc(d);
}

export function isWeekendKey(key: string): boolean {
  const day = dateFromKey(key)?.getUTCDay();
  return day === 0 || day === 6;
}

/** Monday→Sunday keys of the week containing `key`. */
export function weekKeysFor(key: string): string[] {
  const d = dateFromKey(key);
  if (!d) return [];
  const mondayOffset = (d.getUTCDay() + 6) % 7;
  const monday = addDaysToKey(key, -mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i));
}

/** All keys of a month (monthIndex is 0-based). */
export function monthKeys(monthIndex: number, year: number): string[] {
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => `${year}-${pad(monthIndex + 1)}-${pad(i + 1)}`);
}

/** "October 2026" for the current IST month. */
export function currentMonthLabel(): string {
  const d = dateFromKey(istDateKey())!;
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "15 August 2026" */
export function formatLongDate(key: string): string {
  const d = dateFromKey(key);
  if (!d) return key;
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "15 Aug 2026" */
export function formatShortDate(key: string): string {
  const d = dateFromKey(key);
  if (!d) return key;
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
}

export function fullDayName(key: string): string {
  const d = dateFromKey(key);
  return d ? FULL_DAY_NAMES[d.getUTCDay()] : "";
}

// ── Times ("09:30 AM" strings, as stored on DailyAttendance) ─────────────────

/** Minutes after midnight for "9:30 AM", "09:30 pm" or 24h "18:30". Null if unparseable. */
export function parseTime12h(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])?\s*$/.exec(value);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (minutes > 59) return null;
  if (m[3]) {
    if (hours < 1 || hours > 12) return null;
    const pm = m[3].toUpperCase() === "PM";
    hours = (hours % 12) + (pm ? 12 : 0);
  } else if (hours > 23) {
    return null;
  }
  return hours * 60 + minutes;
}

export function formatTime12h(minutesAfterMidnight: number): string {
  const h24 = Math.floor(minutesAfterMidnight / 60) % 24;
  const m = minutesAfterMidnight % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${pad(h12)}:${pad(m)} ${h24 >= 12 ? "PM" : "AM"}`;
}

/** Normalises any accepted time input to the stored "hh:mm AM" form. */
export function normalizeTime(value: string): string | null {
  const mins = parseTime12h(value);
  return mins === null ? null : formatTime12h(mins);
}

/** Minutes between check-in and check-out; null when either is missing or out <= in. */
export function workedMinutesBetween(checkIn?: string | null, checkOut?: string | null): number | null {
  const a = parseTime12h(checkIn);
  const b = parseTime12h(checkOut);
  if (a === null || b === null || b <= a) return null;
  return b - a;
}

/** "8h 05m" */
export function formatWorkedDuration(minutes: number | null | undefined): string | undefined {
  if (minutes === null || minutes === undefined || minutes <= 0) return undefined;
  return `${Math.floor(minutes / 60)}h ${pad(minutes % 60)}m`;
}

/** "08:05" */
export function formatClock(minutes: number): string {
  const abs = Math.abs(minutes);
  return `${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export const EXPECTED_SHIFT_MINUTES =
  (parseTime12h(SHIFT_END) ?? 0) - (parseTime12h(SHIFT_START) ?? 0);

export type ShiftDiff = { type: "early" | "late" | "on-time"; label: string };

function diffLabel(mins: number): string {
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${pad(mins % 60)}m` : `${pad(mins)} min`;
}

/** Early/late compared to the configured shift boundary. */
export function shiftDiff(actual: string | null | undefined, boundary: string): ShiftDiff | undefined {
  const a = parseTime12h(actual);
  const b = parseTime12h(boundary);
  if (a === null || b === null) return undefined;
  if (a === b) return { type: "on-time", label: "On time" };
  return a < b
    ? { type: "early", label: `${diffLabel(b - a)} Early` }
    : { type: "late", label: `${diffLabel(a - b)} Late` };
}

export function netHours(workedMinutes: number): { type: "positive" | "negative" | "neutral"; label: string } {
  const net = workedMinutes - EXPECTED_SHIFT_MINUTES;
  return {
    type: net > 0 ? "positive" : net < 0 ? "negative" : "neutral",
    label: `${net < 0 ? "-" : "+"}${formatClock(net)}`,
  };
}

// ── Leave ↔ attendance ───────────────────────────────────────────────────────

export interface LeaveSpan {
  fromDate: Date;
  toDate: Date;
  durationType: string;
  durationDays: number;
  status: string;
  isLossOfPay: boolean;
  lopDaysCount: number;
}

export function leaveCoversKey(leave: Pick<LeaveSpan, "fromDate" | "toDate">, key: string): boolean {
  return key >= dateKeyFromUtc(leave.fromDate) && key <= dateKeyFromUtc(leave.toDate);
}

/** Fraction of a working day (0–1) that this leave takes on `key`. */
export function leaveFractionOnDay(leave: LeaveSpan, key: string): number {
  if (!leaveCoversKey(leave, key)) return 0;
  if (leave.durationType === "FULL_DAY") return 1;
  const singleDay = dateKeyFromUtc(leave.fromDate) === dateKeyFromUtc(leave.toDate);
  if (singleDay) return Math.min(1, Math.max(0, leave.durationDays));
  if (leave.durationType === "HALF_DAY") return 0.5;
  if (leave.durationType === "QUARTER_DAY") return 0.25;
  return 0;
}

/** Share of a leave that is unpaid (LOP), 0–1. */
export function leaveLopShare(leave: LeaveSpan): number {
  if (!leave.isLossOfPay || leave.durationDays <= 0) return 0;
  return Math.min(1, Math.max(0, leave.lopDaysCount / leave.durationDays));
}

// ── Day resolution ───────────────────────────────────────────────────────────

export interface DayAttendanceInput {
  status: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  isLive: boolean;
}

export interface ResolveDayInput {
  key: string;
  todayKey: string;
  isHoliday: boolean;
  attendance: DayAttendanceInput | null;
  /** Approved leaves overlapping this day. */
  approvedLeaves: LeaveSpan[];
  hasPendingLeave: boolean;
  /** Latest regularization for this day, if any. */
  regularizationStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  /** The day is before the employee joined: nothing is expected, nothing counts. */
  beforeJoining?: boolean;
}

export interface ResolvedDay {
  status: AttendanceStatus;
  isWorkingDay: boolean;
  /** Day fractions — present + paidLeave + lopLeave + absent = 1 on a past working day. */
  present: number;
  paidLeave: number;
  lopLeave: number;
  absent: number;
  /** Set when the employee still has to regularize or apply leave for this day. */
  action?: { type: ActionRequiredType; issue: string };
  /** Shown on the day even when no action is offered (e.g. regularization pending). */
  note?: string;
  /** Set on days before the employee joined (not a working day, but not a weekend either). */
  beforeJoining?: boolean;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function resolveDay(input: ResolveDayInput): ResolvedDay {
  const { key, todayKey, attendance, regularizationStatus } = input;

  // Before joining there is no working day to miss — unless there's real attendance for it.
  if (input.beforeJoining && !attendance?.checkInTime) {
    return {
      status: "ABSENT",
      isWorkingDay: false,
      present: 0, paidLeave: 0, lopLeave: 0, absent: 0,
      note: "Before joining",
      beforeJoining: true,
    };
  }

  if (input.isHoliday || isWeekendKey(key)) {
    // Working on a day off (comp-off) still needs a live check-out today; it never counts toward payroll.
    const liveToday = key === todayKey && attendance?.isLive && !attendance.checkOutTime;
    return {
      status: liveToday ? "WORKING_NOW" : input.isHoliday ? "HOLIDAY" : "WEEKEND",
      isWorkingDay: false,
      present: 0, paidLeave: 0, lopLeave: 0, absent: 0,
    };
  }

  let paidLeave = 0;
  let lopLeave = 0;
  for (const leave of input.approvedLeaves) {
    const frac = leaveFractionOnDay(leave, key);
    const lop = frac * leaveLopShare(leave);
    lopLeave += lop;
    paidLeave += frac - lop;
  }
  const leaveTotal = Math.min(1, paidLeave + lopLeave);
  if (paidLeave + lopLeave > 1) {
    const scale = 1 / (paidLeave + lopLeave);
    paidLeave *= scale;
    lopLeave *= scale;
  }
  const rest = round(1 - leaveTotal);
  const base = { isWorkingDay: true, paidLeave: round(paidLeave), lopLeave: round(lopLeave) };

  if (leaveTotal >= 1) {
    return { ...base, status: "ON_LEAVE", present: 0, absent: 0 };
  }

  const isPast = key < todayKey;
  const isToday = key === todayKey;
  const hasIn = Boolean(attendance?.checkInTime);
  const hasOut = Boolean(attendance?.checkOutTime);

  const pendingReg = regularizationStatus === "PENDING";
  const regNote = pendingReg ? "Regularization pending approval" : undefined;
  const rejectedHint = regularizationStatus === "REJECTED" ? " (regularization rejected)" : "";

  if (hasIn && hasOut) {
    if (leaveTotal > 0) return { ...base, status: "HALF_DAY_LEAVE", present: rest, absent: 0 };
    return {
      ...base,
      status: attendance?.status === "EARLY_LEAVE" ? "EARLY_LEAVE" : "PRESENT",
      present: 1,
      absent: 0,
    };
  }

  if (hasIn && !hasOut) {
    if (isToday) {
      // Still on the clock (or checked in without going live) — counts as present for today.
      return { ...base, status: attendance?.isLive ? "WORKING_NOW" : "PRESENT", present: rest, absent: 0 };
    }
    // A past day with a check-in but no check-out needs regularizing.
    return {
      ...base,
      status: "ACTION_REQUIRED",
      present: 0,
      absent: rest,
      note: regNote,
      action: pendingReg ? undefined : { type: "MISSING_CHECKOUT", issue: `Missing Check-out${rejectedHint}` },
    };
  }

  // No check-in at all.
  if (leaveTotal > 0) {
    return {
      ...base,
      status: "HALF_DAY_LEAVE",
      present: 0,
      absent: isPast ? rest : 0,
      note: regNote,
      action:
        isPast && !pendingReg
          ? { type: "MISSING_BOTH", issue: `No attendance for the rest of the day${rejectedHint}` }
          : undefined,
    };
  }

  if (input.hasPendingLeave) {
    // Leave applied but not yet approved — nothing to regularize, nothing to count yet.
    return { ...base, status: "ON_LEAVE", present: 0, absent: 0, note: "Leave pending approval" };
  }

  if (isPast) {
    return {
      ...base,
      status: "ACTION_REQUIRED",
      present: 0,
      absent: 1,
      note: regNote,
      action: pendingReg ? undefined : { type: "MISSING_BOTH", issue: `Missing Check-in & Check-out${rejectedHint}` },
    };
  }

  return { ...base, status: "ABSENT", present: 0, absent: 0 };
}

// ── Month roll-up for payroll ────────────────────────────────────────────────

export interface MonthRollup {
  companyWorkingDays: number;
  presentDays: number;
  halfDays: number;
  paidOffs: number;
  lossOfPay: number;
  absentDays: number;
  /** Days that are paid: present + half-day worked portions + paid leave. */
  paidDays: number;
}

export function rollupMonth(days: ResolvedDay[]): MonthRollup {
  const r: MonthRollup = {
    companyWorkingDays: 0, presentDays: 0, halfDays: 0, paidOffs: 0, lossOfPay: 0, absentDays: 0, paidDays: 0,
  };
  for (const d of days) {
    if (!d.isWorkingDay) continue;
    r.companyWorkingDays += 1;
    if (d.present >= 1) r.presentDays += 1;
    else if (d.status === "HALF_DAY_LEAVE") r.halfDays += 1;
    r.paidOffs += d.paidLeave;
    r.lossOfPay += d.lopLeave;
    r.absentDays += d.absent;
    r.paidDays += d.present + d.paidLeave;
  }
  for (const k of Object.keys(r) as (keyof MonthRollup)[]) r[k] = round(r[k]);
  return r;
}

// ── Permissions ──────────────────────────────────────────────────────────────

/** Who may review regularizations, view other people's attendance and act on leave for others. */
export function canManageAttendance(user: { role?: string | null; profileRole?: string | null } | null | undefined): boolean {
  if (!user) return false;
  return user.role === "MANAGER" || user.profileRole === "MANAGER" || user.profileRole === "ADMIN";
}
