// Pure helpers — no server imports, fully unit-testable.
// Calendar times are wall-clock (local timezone), unlike dsm/utils.ts which
// is UTC-anchored for pure date (no time-of-day) comparisons.

import { toTitleText } from "@/lib/utils";

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

/** Convert a <input type="datetime-local"> value (local wall-clock, no TZ) into a Date locked to Asia/Kolkata (+05:30). */
export function fromDateTimeLocalValue(value: string): Date {
  if (!value) return new Date();
  const clean = value.trim();
  if (clean.includes("Z") || /[+-]\d{2}:\d{2}$/.test(clean)) {
    return new Date(clean);
  }
  const formatted = clean.length === 16 ? `${clean}:00+05:30` : clean.length === 19 ? `${clean}+05:30` : clean;
  const d = new Date(formatted);
  if (!isNaN(d.getTime())) return d;
  return new Date(value);
}

/** Format a Date as a value for <input type="datetime-local"> in Indian Standard Time (Asia/Kolkata). */
export function toDateTimeLocalValue(date: Date): string {
  if (!date || isNaN(date.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  let hour = getPart("hour");
  if (hour === "24") hour = "00";
  const minute = getPart("minute");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export type EventDateTimeErrors = { start?: string; end?: string };

/**
 * Shared start/end validation used by both the Create Event UI (live, per keystroke)
 * and the server action (final guard before the DB write) so the rules can't diverge
 * or be bypassed by calling the action directly.
 */
export function validateEventDateTime(start: Date, end: Date, now: Date = new Date()): EventDateTimeErrors {
  const errors: EventDateTimeErrors = {};

  const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (startDateOnly < todayOnly) {
    errors.start = "You cannot schedule an event for a previous date.";
  } else if (start.getTime() <= now.getTime()) {
    errors.start = "Start time must be later than the current time.";
  }

  if (!errors.start) {
    if (end.getTime() <= start.getTime()) {
      errors.end = "End time must be later than start time.";
    } else if (
      end.getFullYear() !== start.getFullYear() ||
      end.getMonth() !== start.getMonth() ||
      end.getDate() !== start.getDate()
    ) {
      errors.end = "Event cannot continue into the next day. Please select an end time on the same date.";
    }
  }

  return errors;
}

/** Event titles: same title case as task / iNotes titles (keeps "TTG", "iNote" as typed). */
export function toTitleCase(str: string): string {
  return toTitleText(str);
}

export type CalendarMentionUser = {
  id: string;
  name: string | null;
  email: string;
};

/**
 * Extracts internal user IDs mentioned in text (e.g. `@Mohit`, `@mohit.thakre`, `@Mohit Thakre`).
 * Handles boundary checks so email addresses like test@domain.com are not false positives.
 */
export function extractMentionsFromText(text: string, users: CalendarMentionUser[]): string[] {
  if (!text || !users || users.length === 0) return [];
  const matchedIds: string[] = [];
  const lowerText = text.toLowerCase();

  // Count first name frequencies among users to avoid ambiguous single-name matches
  const firstNameCounts = new Map<string, number>();
  for (const u of users) {
    const fn = (u.name || "").trim().split(/\s+/)[0]?.toLowerCase();
    if (fn) firstNameCounts.set(fn, (firstNameCounts.get(fn) || 0) + 1);
  }

  for (const user of users) {
    const name = (user.name || "").trim().toLowerCase();
    const emailPrefix = user.email.split("@")[0].toLowerCase();
    const firstName = name.split(/\s+/)[0];
    const isFirstNameUnique = Boolean(firstName && (firstNameCounts.get(firstName) ?? 0) === 1);

    const candidates = [
      name ? `@${name}` : null,
      isFirstNameUnique ? `@${firstName}` : null,
      `@${emailPrefix}`,
    ].filter(Boolean) as string[];

    for (const pat of candidates) {
      let searchPos = 0;
      let found = false;
      while (searchPos < lowerText.length) {
        const idx = lowerText.indexOf(pat, searchPos);
        if (idx === -1) break;

        const charBefore = idx > 0 ? lowerText[idx - 1] : " ";
        const charAfter = idx + pat.length < lowerText.length ? lowerText[idx + pat.length] : " ";

        const validBefore = /[\s,.:;!?'"()\[\]{}]/.test(charBefore) || idx === 0;
        const validAfter = /[\s,.:;!?'"()\[\]{}]/.test(charAfter) || idx + pat.length === lowerText.length;

        if (validBefore && validAfter) {
          if (!matchedIds.includes(user.id)) {
            matchedIds.push(user.id);
          }
          found = true;
          break;
        }
        searchPos = idx + 1;
      }
      if (found) break;
    }
  }

  return matchedIds;
}

/**
 * Reconciles participant selections based on additions and removals of mentions in the title.
 * - Newly mentioned IDs are added to `currentSelectedIds`.
 * - Mentions that were removed from the title are removed from `currentSelectedIds`.
 * - Manual participant picks that were never mentioned are kept untouched.
 */
export function reconcileMentionParticipants(
  currentSelectedIds: string[],
  prevMentionedIds: Set<string>,
  nextMentionedIds: string[],
): { nextSelectedIds: string[]; nextMentionedIds: Set<string> } {
  const nextMentionSet = new Set(nextMentionedIds);
  const added = nextMentionedIds.filter((id) => !prevMentionedIds.has(id));
  const removed = Array.from(prevMentionedIds).filter((id) => !nextMentionSet.has(id));

  let nextSelected = [...currentSelectedIds];

  // Add newly mentioned IDs
  for (const id of added) {
    if (!nextSelected.includes(id)) {
      nextSelected.push(id);
    }
  }

  // Remove IDs that were un-mentioned
  if (removed.length > 0) {
    nextSelected = nextSelected.filter((id) => !removed.includes(id));
  }

  return {
    nextSelectedIds: nextSelected,
    nextMentionedIds: nextMentionSet,
  };
}



