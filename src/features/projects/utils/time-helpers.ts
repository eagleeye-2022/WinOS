/**
 * Time & Duration Helpers for WinOS Time Tracker
 */

/**
 * Formats a Date object into a 12-hour AM/PM string, e.g. "6:00 PM", "10:52 AM", "12:00 AM".
 * Hour does not have leading zero, minutes has 2 digits, uppercase AM/PM.
 */
export function formatTime12h(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * A time log's calendar day as YYYY-MM-DD in IST. Log dates are stored as
 * instants (imported logs at midnight IST), so taking the UTC date shows them
 * one day early.
 */
export function toISTDateString(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(date));
}

/**
 * Parses a 12-hour or 24-hour time string into minutes since midnight (0..1439).
 * E.g. "6:00 PM" -> 1080, "6:00 AM" -> 360, "10:52 am" -> 652, "18:00" -> 1080.
 */
export function parseTimeToMinutes(val: string): number | null {
  if (!val || !val.trim()) return null;
  const trimmed = val.trim();

  // 12-hour format: "6:00 PM", "10:52 am", "9:15 AM"
  const match12 = trimmed.match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s*(am|pm)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const period = match12[3].toLowerCase();
    if (period === "pm" && h !== 12) h += 12;
    if (period === "am" && h === 12) h = 0;
    return h * 60 + m;
  }

  // 24-hour format: "18:00", "06:00"
  const match24 = trimmed.match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/);
  if (match24) {
    return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
  }

  return null;
}

/**
 * Effort-log rule: a log (timer or manual) can be any length, but its start and end must fall on
 * the same calendar day — 6:00 AM–6:00 PM or 7:00 AM–8:00 PM are fine, 10:00 PM–1:00 AM is not.
 * So the longest possible log is 23:59.
 */
export const MAX_LOG_MINUTES = 24 * 60 - 1;
export const SAME_DAY_LOG_ERROR = "Start and end time must be on the same day.";
export const MAX_LOG_DURATION_ERROR = "An effort log can't be longer than one day (23:59).";

/** Local calendar date of `d` as "YYYY-MM-DD" (unlike toISOString, which gives the UTC date). */
export function toLocalDateString(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** True when both instants fall on the same local calendar day. */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return toLocalDateString(a) === toLocalDateString(b);
}

/**
 * Duration in minutes between a start and end time string on the same day, e.g.
 * "6:00 AM" → "6:00 PM" = 720. Returns null when either time is invalid or the end isn't after
 * the start (a range can't run past midnight — see MAX_LOG_MINUTES).
 */
export function calculateMinutesFromTimeRange(startTimeStr: string, endTimeStr: string): number | null {
  const startMin = parseTimeToMinutes(startTimeStr);
  const endMin = parseTimeToMinutes(endTimeStr);
  if (startMin === null || endMin === null) return null;
  const diff = endMin - startMin;
  return diff > 0 ? diff : null;
}

/**
 * Sort comparator for time logs, latest first: by day (YYYY-MM-DD or DD/MM/YYYY),
 * then by the start of the time period ("9:28 AM – 10:10 AM"). Logs without a
 * time period sort after timed logs of the same day.
 */
export function compareTimeLogsLatestFirst(
  a: { date: string; timePeriod?: string },
  b: { date: string; timePeriod?: string }
): number {
  const dayKey = (d: string) => {
    const dmy = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : d;
  };
  const startMinutes = (tp?: string) => parseTimeToMinutes((tp ?? "").split(/[-–]/)[0]) ?? -1;
  const byDay = dayKey(b.date).localeCompare(dayKey(a.date));
  return byDay !== 0 ? byDay : startMinutes(b.timePeriod) - startMinutes(a.timePeriod);
}

/**
 * Standardizes a start & end time range into 12-hour AM/PM format, e.g. "6:00 PM – 6:00 AM".
 */
export function formatTimePeriodRange(startTimeStr: string, endTimeStr: string): string {
  const startMin = parseTimeToMinutes(startTimeStr);
  const endMin = parseTimeToMinutes(endTimeStr);

  if (startMin === null || endMin === null) {
    return "";
  }

  const formatMinTo12h = (totalMins: number) => {
    let h = Math.floor(totalMins / 60) % 24;
    const m = (totalMins % 60).toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    h = h ? h : 12;
    return `${h}:${m} ${ampm}`;
  };

  return `${formatMinTo12h(startMin)} – ${formatMinTo12h(endMin)}`;
}

/**
 * Parses any duration string or number into total minutes.
 * Handles formats like:
 * - "13h", "13.5h", "13 hrs", "13 hours" -> 780, 810
 * - "01:30", "1:30", "12:00" -> 90, 720
 * - "90m", "90 mins" -> 90
 * - 90 -> 90
 */
export function parseDurationMinutes(duration: string | number | null | undefined): number {
  if (typeof duration === "number") return Math.max(0, Math.round(duration));
  if (!duration) return 0;
  const str = String(duration).trim();
  if (!str) return 0;

  // HH:MM format e.g. "01:30", "12:00", "13:00"
  if (str.includes(":")) {
    const parts = str.replace(/[^0-9:]/g, "").split(":");
    const hrs = parseInt(parts[0] || "0", 10);
    const mins = parseInt(parts[1] || "0", 10);
    return hrs * 60 + mins;
  }

  // Hours format e.g. "13h", "13.5h", "13 hrs", "13 hours"
  const matchH = str.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?$/i);
  if (matchH) {
    return Math.round(parseFloat(matchH[1]) * 60);
  }

  // Minutes format e.g. "90m", "90 mins"
  const matchM = str.match(/^(\d+(?:\.\d+)?)\s*m(?:ins?)?$/i);
  if (matchM) {
    return Math.round(parseFloat(matchM[1]));
  }

  // Fallback number (assume minutes if purely numeric)
  const val = parseFloat(str);
  if (!isNaN(val)) {
    return Math.round(val);
  }

  return 0;
}

/**
 * Formats duration minutes into standard display string in 00:00 (HH:MM) format.
 * E.g., 720 mins -> "12:00", 780 mins -> "13:00", 90 mins -> "01:30", 8 mins -> "00:08".
 */
export function formatDurationDisplay(minutes: number): string {
  if (!minutes || minutes <= 0) return "00:00";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Robust date and time parser.
 * Handles DD/MM/YYYY, YYYY-MM-DD, ISO strings, or Date objects, and optionally sets the time from a 12h/24h time string.
 */
export function parseDateAndTimeToDate(
  dateVal?: string | Date | null,
  timeStr?: string | null
): Date {
  // Times are Indian Standard Time wall-clock times (what the user typed), whatever time zone the
  // server runs in — it runs in UTC when deployed, where using the server's local time stored
  // "10 Oct, 8:00 PM" as 8 PM UTC = 1:30 AM IST on 11 Oct.
  const mins = timeStr && timeStr.trim() ? parseTimeToMinutes(timeStr) : null;
  let day: { y: number; m: number; d: number } | null = null;

  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    if (mins === null) return new Date(dateVal.getTime());
    day = istCalendarDay(dateVal);
  } else if (typeof dateVal === "string" && dateVal.trim()) {
    const str = dateVal.trim();
    const matchDDMM = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/); // DD/MM/YYYY or DD-MM-YYYY
    const matchISO = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); // YYYY-MM-DD (date only)
    if (matchDDMM) {
      day = { y: +matchDDMM[3], m: +matchDDMM[2] - 1, d: +matchDDMM[1] };
    } else if (matchISO) {
      day = { y: +matchISO[1], m: +matchISO[2] - 1, d: +matchISO[3] };
    } else {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        if (mins === null) return parsed;
        day = istCalendarDay(parsed);
      }
    }
  }

  if (!day) {
    if (mins === null) return new Date();
    day = istCalendarDay(new Date());
  }
  // A date with no time is stored as midnight UTC of that calendar date — the convention the
  // DSM / Report day matching (logMatchesDay) treats as "the whole day".
  if (mins === null) return new Date(Date.UTC(day.y, day.m, day.d));
  return new Date(Date.UTC(day.y, day.m, day.d, 0, mins) - IST_OFFSET_MINUTES * 60000);
}

/** India has one fixed offset (+05:30) and no daylight saving. */
const IST_OFFSET_MINUTES = 330;

/** Calendar day of `d` in IST. */
function istCalendarDay(d: Date): { y: number; m: number; d: number } {
  const shifted = new Date(d.getTime() + IST_OFFSET_MINUTES * 60000);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

/**
 * Helper to format total minutes into "HH:MM" or "HH:MM h" format for summary displays.
 */
export function formatMinutesToHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Encodes timePeriod metadata into description field: "[6:00 PM – 6:00 AM] Remarks"
 */
export function encodeDescriptionWithTimePeriod(remarks?: string | null, timePeriod?: string | null): string | null {
  const cleanRemarks = remarks?.trim() || "";
  const cleanTimePeriod = timePeriod?.trim() || "";

  if (cleanTimePeriod) {
    return cleanRemarks ? `[${cleanTimePeriod}] ${cleanRemarks}` : `[${cleanTimePeriod}]`;
  }
  return cleanRemarks || null;
}

/**
 * Decodes description field from DB into timePeriod and remarks.
 */
export function decodeDescriptionWithTimePeriod(description?: string | null): {
  timePeriod: string;
  remarks: string;
} {
  if (!description) {
    return { timePeriod: "", remarks: "" };
  }
  const match = description.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (match) {
    return {
      timePeriod: match[1].trim(),
      remarks: match[2].trim(),
    };
  }
  return {
    timePeriod: "",
    remarks: description.trim(),
  };
}

/**
 * Resolves the actual time period string for a log.
 * If timePeriod is recorded in DB (e.g. live timer start/stop or manual range entry), returns it,
 * whatever the duration. Otherwise (older/imported logs saved without one), for durations up to
 * 12 hours it derives a start–end range from the log timestamp and duration; longer unrecorded
 * logs return "" (showing duration only), since a derived range for those is a guess.
 */
export function resolveLogTimePeriod(
  recordedTimePeriod: string | undefined | null,
  durationMinutes: number,
  logDateOrCreatedAt?: Date | string | null
): string {
  if (recordedTimePeriod && recordedTimePeriod.trim()) {
    return recordedTimePeriod.trim();
  }
  if (durationMinutes > 720) return "";

  const end = logDateOrCreatedAt
    ? logDateOrCreatedAt instanceof Date
      ? logDateOrCreatedAt
      : new Date(logDateOrCreatedAt)
    : new Date();

  if (isNaN(end.getTime())) {
    return "";
  }

  const start = new Date(end.getTime() - durationMinutes * 60000);
  return `${formatTime12h(start)} – ${formatTime12h(end)}`;
}
