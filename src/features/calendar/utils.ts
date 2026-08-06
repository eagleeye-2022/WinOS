// Pure helpers — no server imports, fully unit-testable.
// Calendar times are wall-clock (local timezone), unlike dsm/utils.ts which
// is UTC-anchored for pure date (no time-of-day) comparisons.

export const CALENDAR_TIMEZONE = "Asia/Kolkata";

/** Monday–Sunday days containing `anchor`. */
export function getWeekDays(anchor: Date): Date[] {
  const dayOfWeek = anchor.getDay(); // 0=Sun
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(anchor);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(anchor.getDate() - daysSinceMonday);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** 6-week (42-day) grid for the month containing `anchor`, including leading/trailing days. */
export function getMonthGridDays(anchor: Date): Date[] {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const leadingDays = (firstOfMonth.getDay() + 6) % 7; // Mon=0
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - leadingDays);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

/** Start/end range covering a full week or month view, used to query Zoho. */
export function getViewRange(view: "week" | "month", anchor: Date): { rangeStart: Date; rangeEnd: Date } {
  if (view === "week") {
    const days = getWeekDays(anchor);
    const rangeStart = days[0];
    const rangeEnd = new Date(days[6]);
    rangeEnd.setHours(23, 59, 59, 999);
    return { rangeStart, rangeEnd };
  }
  const days = getMonthGridDays(anchor);
  const rangeStart = days[0];
  const rangeEnd = new Date(days[days.length - 1]);
  rangeEnd.setHours(23, 59, 59, 999);
  return { rangeStart, rangeEnd };
}

export function isSameDay(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined,
): boolean {
  if (!a || !b) return false;
  const dateA = a instanceof Date ? a : new Date(a);
  const dateB = b instanceof Date ? b : new Date(b);
  if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return false;

  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

/** Format a date like "Jul 29" */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: CALENDAR_TIMEZONE,
  }).format(date);
}

/** Format a date like "Wednesday, Jul 29 2026" */
export function formatFullDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: CALENDAR_TIMEZONE,
  }).format(date);
}

/** Format a time like "1:30 PM" */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: CALENDAR_TIMEZONE,
  }).format(date);
}

export function formatEventTimeRange(start: Date, end: Date, isAllDay: boolean): string {
  if (isAllDay) return "All day";
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** Convert a <input type="datetime-local"> value (local wall-clock, no TZ) into a Date. */
export function fromDateTimeLocalValue(value: string): Date {
  return new Date(value);
}

/** Format a Date as a value for <input type="datetime-local">. */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}


