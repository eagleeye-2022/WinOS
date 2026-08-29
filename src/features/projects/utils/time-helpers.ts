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
 * Calculates duration in minutes between start time and end time strings.
 * Handles overnight crossover (e.g., 6:00 PM to 6:00 AM = 720 minutes = 12h).
 */
export function calculateMinutesFromTimeRange(startTimeStr: string, endTimeStr: string): number | null {
  const startMin = parseTimeToMinutes(startTimeStr);
  const endMin = parseTimeToMinutes(endTimeStr);
  if (startMin === null || endMin === null) return null;

  let diff = endMin - startMin;
  if (diff <= 0) {
    diff += 24 * 60; // Midnight crossover
  }
  return diff;
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
 * Formats duration minutes into standard display string.
 * Rules:
 * - If duration > 12 hours (720 mins), return e.g. "13h" (or "13h 30m")
 * - If exact hours (e.g. 720 mins = 12h, 60 mins = 1h), return "12h", "1h"
 * - Otherwise return "HH:MM" e.g. "00:08", "01:30"
 */
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
  let baseDate = new Date();

  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    baseDate = new Date(dateVal.getTime());
  } else if (typeof dateVal === "string" && dateVal.trim()) {
    const str = dateVal.trim();
    // DD/MM/YYYY or DD-MM-YYYY
    const matchDDMM = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
    if (matchDDMM) {
      const d = parseInt(matchDDMM[1], 10);
      const m = parseInt(matchDDMM[2], 10) - 1;
      const y = parseInt(matchDDMM[3], 10);
      baseDate = new Date(y, m, d);
    } else {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        baseDate = parsed;
      }
    }
  }

  if (timeStr && timeStr.trim()) {
    const mins = parseTimeToMinutes(timeStr);
    if (mins !== null) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      baseDate.setHours(h, m, 0, 0);
    }
  }

  return baseDate;
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
 * If timePeriod is recorded in DB (e.g. live timer start/stop or manual range entry), returns it.
 * Otherwise, if duration <= 12 hours (720 mins), derives actual start and end times from log timestamp and duration.
 * If duration > 12 hours, returns "" (showing duration only).
 */
export function resolveLogTimePeriod(
  recordedTimePeriod: string | undefined | null,
  durationMinutes: number,
  logDateOrCreatedAt?: Date | string | null
): string {
  if (durationMinutes > 720) return "";
  if (recordedTimePeriod && recordedTimePeriod.trim()) {
    return recordedTimePeriod.trim();
  }

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
