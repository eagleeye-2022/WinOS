// Pure helpers for calendar event recurrence — no server imports, fully unit-testable.
// Dates are treated as instants; all "local calendar date" math (weekday, day-of-month,
// "until" comparisons) is anchored to CALENDAR_TIMEZONE (Asia/Kolkata, fixed +05:30, no DST),
// matching the rest of the calendar feature (see utils.ts).

import { CALENDAR_TIMEZONE } from "./utils";

export type Weekday = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";
export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type MonthlyMode = "DATE" | "DAY";

/**
 * A simplified recurrence rule (not RFC5545 RRULE, but maps 1:1 onto it if we
 * ever need to hand this to an external calendar). Persisted as JSON in
 * CalendarEvent.recurrenceRule.
 */
export type RecurrenceRule = {
  freq: RecurrenceFreq;
  /** Repeat every N days/weeks/months/years. Always >= 1. */
  interval: number;
  /** WEEKLY only — which weekdays. Defaults to the start date's weekday if omitted. */
  byDay?: Weekday[];
  /** MONTHLY only — "DATE" = same day-of-month as start; "DAY" = same nth weekday-of-month as start. */
  monthlyMode?: MonthlyMode;
  /** Inclusive last local date (yyyy-mm-dd) an occurrence may start on. Null/undefined = never ends. */
  until?: string | null;
};

export type Occurrence = { start: Date; end: Date };

const WEEKDAYS: Weekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const WEEKDAY_LABEL: Record<Weekday, string> = {
  SU: "Sunday", MO: "Monday", TU: "Tuesday", WE: "Wednesday", TH: "Thursday", FR: "Friday", SA: "Saturday",
};
const MONTH_LABEL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const ORDINAL_WORD = ["first", "second", "third", "fourth", "fifth"];
const WEEKDAY_ORDER: Weekday[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local (CALENDAR_TIMEZONE) calendar date + time-of-day for a Date instant. */
function toLocalParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

/** Local weekday code for a Date instant. */
export function localWeekday(date: Date): Weekday {
  const s = new Intl.DateTimeFormat("en-US", { timeZone: CALENDAR_TIMEZONE, weekday: "short" }).format(date).toUpperCase();
  return s.slice(0, 2) as Weekday;
}

/** "yyyy-mm-dd" for the local calendar date of a Date instant — used for <input type="date"> and `until` comparisons. */
export function localDateInputValue(date: Date): string {
  const { year, month, day } = toLocalParts(date);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Build the real instant for local y-m-d, at the same local time-of-day as `timeSource`. */
function atLocalDate(year: number, month: number, day: number, timeSource: Date): Date {
  const t = toLocalParts(timeSource);
  return new Date(`${year}-${pad2(month)}-${pad2(day)}T${pad2(t.hour)}:${pad2(t.minute)}:${pad2(t.second)}+05:30`);
}

/** Move `date` to `weekday` within its own local (Mon-Sun) week, preserving local time-of-day. */
export function withLocalWeekday(date: Date, weekday: Weekday): Date {
  const parts = toLocalParts(date);
  const dateUTC = Date.UTC(parts.year, parts.month - 1, parts.day);
  const dow = new Date(dateUTC).getUTCDay();
  const daysSinceMonday = (dow + 6) % 7;
  const mondayUTC = dateUTC - daysSinceMonday * 86_400_000;
  const targetOffset = (WEEKDAYS.indexOf(weekday) + 6) % 7;
  const target = new Date(mondayUTC + targetOffset * 86_400_000);
  return atLocalDate(target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate(), date);
}

/** Number of days in the given local month (month is 1-12). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Which occurrence (1-5) of its weekday `day` falls on within its month. */
function weekdayOccurrenceIndex(day: number): number {
  return Math.ceil(day / 7);
}

/** The local date of the nth (1-5) occurrence of `weekday` in y-m, or null if it doesn't exist. */
function nthWeekdayOfMonth(year: number, month: number, weekday: Weekday, nth: number): number | null {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun
  const targetDow = WEEKDAYS.indexOf(weekday);
  const firstMatch = 1 + ((targetDow - firstDow + 7) % 7);
  const day = firstMatch + (nth - 1) * 7;
  return day <= daysInMonth(year, month) ? day : null;
}

function ordinalDay(d: number): string {
  if (d % 10 === 1 && d !== 11) return `${d}st`;
  if (d % 10 === 2 && d !== 12) return `${d}nd`;
  if (d % 10 === 3 && d !== 13) return `${d}rd`;
  return `${d}th`;
}

// ── Presets (match the Google-Calendar-style dropdown) ─────────────────────────

export function presetDaily(): RecurrenceRule {
  return { freq: "DAILY", interval: 1 };
}
export function presetWeeklyOnStart(start: Date): RecurrenceRule {
  return { freq: "WEEKLY", interval: 1, byDay: [localWeekday(start)] };
}
export function presetEveryWeekday(): RecurrenceRule {
  return { freq: "WEEKLY", interval: 1, byDay: ["MO", "TU", "WE", "TH", "FR"] };
}
export function presetMonthlyOnDate(): RecurrenceRule {
  return { freq: "MONTHLY", interval: 1, monthlyMode: "DATE" };
}
export function presetMonthlyOnDay(): RecurrenceRule {
  return { freq: "MONTHLY", interval: 1, monthlyMode: "DAY" };
}
export function presetYearly(): RecurrenceRule {
  return { freq: "YEARLY", interval: 1 };
}

export type PresetOption = { key: string; label: string; rule: RecurrenceRule | null };

/** The fixed preset list shown in the dropdown, labelled relative to `start`. "custom" has rule: null — the UI opens the custom dialog for it instead of applying directly. */
export function buildPresetOptions(start: Date): PresetOption[] {
  const { day, month } = toLocalParts(start);
  const wd = localWeekday(start);
  const nth = weekdayOccurrenceIndex(day);
  const nthLabel = ORDINAL_WORD[nth - 1] ?? `${nth}th`;

  return [
    { key: "none", label: "Does not repeat", rule: null },
    { key: "daily", label: "Daily", rule: presetDaily() },
    { key: "weekly", label: `Weekly on ${WEEKDAY_LABEL[wd]}`, rule: presetWeeklyOnStart(start) },
    { key: "weekday", label: "Every weekday (Monday to Friday)", rule: presetEveryWeekday() },
    { key: "monthly-date", label: `Monthly on the ${ordinalDay(day)}`, rule: presetMonthlyOnDate() },
    { key: "monthly-day", label: `Monthly on the ${nthLabel} ${WEEKDAY_LABEL[wd]}`, rule: presetMonthlyOnDay() },
    { key: "yearly", label: `Yearly on ${MONTH_LABEL[month - 1]} ${ordinalDay(day)}`, rule: presetYearly() },
    { key: "custom", label: "Custom...", rule: null },
  ];
}

/** Which preset key (if any) exactly matches `rule` — used to highlight the current selection. "none" if rule is null, "custom" if it doesn't match a preset. */
export function matchPresetKey(rule: RecurrenceRule | null, start: Date): string {
  if (!rule) return "none";
  const options = buildPresetOptions(start).filter((o) => o.key !== "none" && o.key !== "custom");
  const match = options.find((o) => o.rule && ruleEquals(o.rule, rule));
  return match?.key ?? "custom";
}

function ruleEquals(a: RecurrenceRule, b: RecurrenceRule): boolean {
  if (a.freq !== b.freq || a.interval !== b.interval || (a.monthlyMode ?? null) !== (b.monthlyMode ?? null)) return false;
  if ((a.until ?? null) !== (b.until ?? null)) return false;
  const aDays = [...(a.byDay ?? [])].sort();
  const bDays = [...(b.byDay ?? [])].sort();
  return aDays.length === bDays.length && aDays.every((d, i) => d === bDays[i]);
}

function formatUntilLabel(until: string): string {
  const [y, m, d] = until.split("-").map(Number);
  return `${MONTH_LABEL[(m ?? 1) - 1]?.slice(0, 3)} ${d}, ${y}`;
}

function sortedByDayLabel(byDay: Weekday[]): string {
  return [...byDay]
    .sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b))
    .map((d) => WEEKDAY_LABEL[d].slice(0, 3))
    .join(", ");
}

/** Human-readable description of a rule, used for the dropdown trigger label and read-only summaries. */
export function describeRule(rule: RecurrenceRule | null, start: Date): string {
  const presetMatch = buildPresetOptions(start).find((o) => o.key !== "custom" && (o.rule ? rule && ruleEquals(o.rule, rule) : !rule));
  if (presetMatch) return presetMatch.label;
  if (!rule) return "Does not repeat";

  const unit = rule.freq === "DAILY" ? "day" : rule.freq === "WEEKLY" ? "week" : rule.freq === "MONTHLY" ? "month" : "year";
  let label = `Every ${rule.interval} ${unit}${rule.interval > 1 ? "s" : ""}`;
  if (rule.freq === "WEEKLY" && rule.byDay && rule.byDay.length > 0) {
    label += ` on ${sortedByDayLabel(rule.byDay)}`;
  }
  if (rule.freq === "MONTHLY") {
    const { day } = toLocalParts(start);
    if ((rule.monthlyMode ?? "DATE") === "DATE") {
      label += ` on the ${ordinalDay(day)}`;
    } else {
      const nth = weekdayOccurrenceIndex(day);
      label += ` on the ${ORDINAL_WORD[nth - 1] ?? `${nth}th`} ${WEEKDAY_LABEL[localWeekday(start)]}`;
    }
  }
  if (rule.until) {
    label += `, until ${formatUntilLabel(rule.until)}`;
  }
  return label;
}

// ── Serialization ────────────────────────────────────────────────────────────

export function serializeRule(rule: RecurrenceRule | null): string | null {
  return rule ? JSON.stringify(rule) : null;
}

export function parseRule(json: string | null | undefined): RecurrenceRule | null {
  if (!json) return null;
  try {
    const obj = JSON.parse(json);
    if (
      obj && typeof obj === "object" &&
      typeof obj.freq === "string" && ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(obj.freq) &&
      typeof obj.interval === "number" && obj.interval >= 1
    ) {
      return obj as RecurrenceRule;
    }
  } catch {
    // malformed/legacy value — treat as no recurrence
  }
  return null;
}

// ── Occurrence expansion ────────────────────────────────────────────────────

/** Safety cap on generated occurrences per event, so an "until"-less rule can't loop forever. */
const MAX_OCCURRENCES = 730;

/**
 * Expand `rule` (anchored at eventStart/eventEnd) into concrete occurrences
 * overlapping [rangeStart, rangeEnd]. Series iteration always stops at `until`
 * (if set) or MAX_OCCURRENCES, whichever comes first — independent of the
 * requested range, so a "never ends" series past the visible range still
 * terminates quickly once it also runs past rangeEnd.
 */
export function expandOccurrences(
  eventStart: Date,
  eventEnd: Date,
  rule: RecurrenceRule,
  rangeStart: Date,
  rangeEnd: Date,
): Occurrence[] {
  const duration = eventEnd.getTime() - eventStart.getTime();
  const startParts = toLocalParts(eventStart);
  const until = rule.until ?? null;
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const rangeEndKey = localDateInputValue(rangeEnd);

  const results: Occurrence[] = [];

  function dateKey(y: number, m: number, d: number): string {
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }
  function withinUntil(y: number, m: number, d: number): boolean {
    return !until || dateKey(y, m, d) <= until;
  }
  function pastRange(y: number, m: number, d: number): boolean {
    return dateKey(y, m, d) > rangeEndKey;
  }
  function addIfInRange(y: number, m: number, d: number) {
    const occStart = atLocalDate(y, m, d, eventStart);
    const occEnd = new Date(occStart.getTime() + duration);
    if (occEnd.getTime() >= rangeStart.getTime() && occStart.getTime() <= rangeEnd.getTime()) {
      results.push({ start: occStart, end: occEnd });
    }
  }

  if (rule.freq === "DAILY") {
    let y = startParts.year, m = startParts.month, d = startParts.day;
    for (let i = 0; i < MAX_OCCURRENCES; i++) {
      if (!withinUntil(y, m, d) || pastRange(y, m, d)) break;
      addIfInRange(y, m, d);
      const next = new Date(Date.UTC(y, m - 1, d + interval));
      y = next.getUTCFullYear(); m = next.getUTCMonth() + 1; d = next.getUTCDate();
    }
  } else if (rule.freq === "WEEKLY") {
    const byDay = rule.byDay && rule.byDay.length > 0 ? rule.byDay : [localWeekday(eventStart)];
    const startUTC = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
    const startDow = new Date(startUTC).getUTCDay();
    const daysSinceMonday = (startDow + 6) % 7;
    const mondayUTC = startUTC - daysSinceMonday * 86_400_000;

    let count = 0;
    for (let offset = 0; count < MAX_OCCURRENCES && offset < MAX_OCCURRENCES * 8; offset++) {
      const weekIndex = Math.floor(offset / 7);
      const cursorUTC = mondayUTC + offset * 86_400_000;
      const cursor = new Date(cursorUTC);
      const y = cursor.getUTCFullYear(), m = cursor.getUTCMonth() + 1, d = cursor.getUTCDate();

      if (pastRange(y, m, d)) break;
      if (!withinUntil(y, m, d)) break;

      if (weekIndex % interval === 0 && cursorUTC >= startUTC && byDay.includes(WEEKDAYS[cursor.getUTCDay()])) {
        addIfInRange(y, m, d);
        count++;
      }
    }
  } else if (rule.freq === "MONTHLY") {
    const mode = rule.monthlyMode ?? "DATE";
    const nth = weekdayOccurrenceIndex(startParts.day);
    const wd = localWeekday(eventStart);

    for (let k = 0; k < MAX_OCCURRENCES; k++) {
      const totalMonths = (startParts.month - 1) + k * interval;
      const y = startParts.year + Math.floor(totalMonths / 12);
      const m = (totalMonths % 12) + 1;
      const d = mode === "DATE"
        ? (startParts.day <= daysInMonth(y, m) ? startParts.day : null)
        : nthWeekdayOfMonth(y, m, wd, nth);

      // Use the last day of the candidate month as a representative date for
      // the until/range boundary checks even when this particular month has
      // no matching day (e.g. "31st" skipping February).
      const guardDay = d ?? daysInMonth(y, m);
      if (!withinUntil(y, m, guardDay) || pastRange(y, m, guardDay)) break;

      if (d) addIfInRange(y, m, d);
    }
  } else if (rule.freq === "YEARLY") {
    for (let k = 0; k < MAX_OCCURRENCES; k++) {
      const y = startParts.year + k * interval;
      const dim = daysInMonth(y, startParts.month);
      const d = Math.min(startParts.day, dim); // clamp Feb 29 on non-leap years

      if (!withinUntil(y, startParts.month, d) || pastRange(y, startParts.month, d)) break;
      addIfInRange(y, startParts.month, d);
    }
  }

  return results;
}
