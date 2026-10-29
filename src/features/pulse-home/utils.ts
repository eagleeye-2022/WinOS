// Pure helpers for the Pulse home page (/people/home). DB-free so they can be unit-tested.

import { addDaysToKey, dateFromKey, type ResolvedDay } from "@/features/attendance/utils";

export type DayTone = "success" | "danger" | "warning" | "muted";

export interface DayLabel {
  label: string;
  tone: DayTone;
}

/** The facts about one person's day that the home page labels are derived from. */
export interface DayLabelInput {
  key: string;
  todayKey: string;
  resolved: ResolvedDay;
  checkInTime: string | null;
  checkOutTime: string | null;
  workMode: string | null;
  holidayName: string | null;
  leaveStatus: string | null;
}

function checkedInLabel(workMode: string | null): string {
  return workMode === "REMOTE" ? "Remote In" : "Office In";
}

/** Status shown under a day in the Work Schedule strip. Null for future days with nothing booked. */
export function scheduleDayLabel(d: DayLabelInput): DayLabel | null {
  const { status } = d.resolved;
  if (d.checkInTime) {
    if (status === "ACTION_REQUIRED") return { label: "Missing check-out", tone: "danger" };
    return { label: checkedInLabel(d.workMode), tone: "success" };
  }
  if (status === "HOLIDAY") return { label: d.holidayName || "Holiday", tone: "warning" };
  if (status === "WEEKEND") return { label: "Weekend", tone: "warning" };
  if (status === "ON_LEAVE") {
    return d.leaveStatus === "PENDING"
      ? { label: "Leave pending", tone: "warning" }
      : { label: "On Leave", tone: "warning" };
  }
  if (status === "HALF_DAY_LEAVE") return { label: "Half-day leave", tone: "warning" };
  if (status === "ACTION_REQUIRED") return { label: "Absent", tone: "danger" };
  if (d.key === d.todayKey) return { label: "Yet to check-in", tone: "danger" };
  return null;
}

/** Today's status next to a person (own card, reporting manager, department members). */
export function presenceLabel(d: DayLabelInput): DayLabel {
  const { status } = d.resolved;
  if (status === "WORKING_NOW") return { label: checkedInLabel(d.workMode), tone: "success" };
  if (d.checkInTime && d.checkOutTime) return { label: "Checked out", tone: "muted" };
  if (d.checkInTime) return { label: checkedInLabel(d.workMode), tone: "success" };
  if (status === "ON_LEAVE" && d.leaveStatus === "APPROVED") return { label: "On Leave", tone: "warning" };
  if (status === "HOLIDAY" || status === "WEEKEND") return { label: "Off today", tone: "muted" };
  return { label: "Yet to check-in", tone: "danger" };
}

/** Sunday→Saturday keys of the week containing `key` (the reference layout starts on Sunday). */
export function sundayWeekKeys(key: string): string[] {
  const d = dateFromKey(key);
  if (!d) return [];
  const sunday = addDaysToKey(key, -d.getUTCDay());
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(sunday, i));
}

/** First and last key of the calendar month before the one containing `key`. */
export function previousMonthRange(key: string): { startKey: string; endKey: string } {
  const endKey = addDaysToKey(`${key.slice(0, 7)}-01`, -1);
  return { startKey: `${endKey.slice(0, 7)}-01`, endKey };
}

/** "06/11/2026" */
export function formatDmy(key: string): string {
  const [y, m, day] = key.split("-");
  return `${day}/${m}/${y}`;
}

/** "Good Morning" / "Good Afternoon" / "Good Evening" for the IST hour. */
export function istGreeting(now: Date = new Date()): string {
  const istHour = new Date(now.getTime() + 330 * 60_000).getUTCHours();
  if (istHour < 12) return "Good Morning";
  if (istHour < 17) return "Good Afternoon";
  return "Good Evening";
}

/** Rounds to 2 decimals, the precision used for day counts across Pulse. */
export function roundDays(n: number): number {
  return Math.round(n * 100) / 100;
}
