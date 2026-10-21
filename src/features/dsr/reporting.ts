// Pure helpers for the end-of-day Report (formerly DSR): cut-off/late calculation, recording-link
// validation and the Zoho Cliq message body. Kept free of DB/auth imports so they're unit-testable
// and safe to import from client components.

const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * Report cut-off: 6:00 AM IST on the day AFTER the report date (members can submit until early the
 * next morning). Override the time with REPORT_CUTOFF_HHMM and the day with REPORT_CUTOFF_DAY_OFFSET
 * (0 = same day as the report, 1 = next day).
 */
export const DEFAULT_REPORT_CUTOFF = "06:00";
export const DEFAULT_CUTOFF_DAY_OFFSET = 1;

/**
 * Hosts a pasted recording link may point at (subdomains included). Defaults to Zoho (Cliq /
 * WorkDrive share links, both .in and .com data centres). Override with
 * REPORT_RECORDING_ALLOWED_HOSTS as a comma-separated list.
 */
export const DEFAULT_RECORDING_HOSTS = [
  "zoho.in",
  "zoho.com",
  "zohoexternal.in",
  "zohoexternal.com",
  "zohopublic.in",
  "zohopublic.com",
];

export function getReportCutoff(): string {
  const raw = process.env.REPORT_CUTOFF_HHMM?.trim();
  return raw && /^\d{1,2}:\d{2}$/.test(raw) ? raw : DEFAULT_REPORT_CUTOFF;
}

/** 0 = cut-off on the report date itself, 1 = next day (default). */
export function getReportCutoffDayOffset(): number {
  const raw = process.env.REPORT_CUTOFF_DAY_OFFSET?.trim();
  return raw === "0" ? 0 : raw === "1" ? 1 : DEFAULT_CUTOFF_DAY_OFFSET;
}

export function getAllowedRecordingHosts(): string[] {
  const raw = process.env.REPORT_RECORDING_ALLOWED_HOSTS;
  if (!raw?.trim()) return DEFAULT_RECORDING_HOSTS;
  return raw.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
}

/** Server-resolved settings handed to the client-side report form/modal. */
export type ReportConfig = {
  /** "06:00" */
  cutoff: string;
  /** Days after the report date the cut-off falls on (1 = next day). */
  cutoffDayOffset: number;
  /** "6:00 AM next day" */
  cutoffLabel: string;
  allowedHosts: string[];
};

/** Call on the server: env vars aren't available to client components. */
export function getReportConfig(): ReportConfig {
  const cutoff = getReportCutoff();
  const cutoffDayOffset = getReportCutoffDayOffset();
  return {
    cutoff,
    cutoffDayOffset,
    cutoffLabel: formatCutoffLabel(cutoff, cutoffDayOffset),
    allowedHosts: getAllowedRecordingHosts(),
  };
}

/** The cut-off instant (UTC) for a report dated `dateStr` (YYYY-MM-DD), interpreted in IST. */
export function getCutoffInstant(
  dateStr: string,
  cutoff = DEFAULT_REPORT_CUTOFF,
  dayOffset = DEFAULT_CUTOFF_DAY_OFFSET
): Date {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const [hh, mm] = cutoff.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dayOffset, hh, mm) - IST_OFFSET_MINUTES * 60_000);
}

/** True when `submittedAt` falls after the report date's cut-off. */
export function isReportLate(
  dateStr: string,
  submittedAt: Date,
  cutoff = DEFAULT_REPORT_CUTOFF,
  dayOffset = DEFAULT_CUTOFF_DAY_OFFSET
): boolean {
  return submittedAt.getTime() > getCutoffInstant(dateStr, cutoff, dayOffset).getTime();
}

/**
 * Late status computed from the report's date + first submit time with the CURRENT cut-off rule.
 * Display code uses this instead of the stored `isLate` flag, which was frozen at submit time (reports
 * filed under an older rule, e.g. the 6 PM same-day cut-off, would otherwise stay wrongly "Late").
 */
export function computeIsLate(
  date: Date | string,
  submittedAt: Date | string | null | undefined,
  cutoff = DEFAULT_REPORT_CUTOFF,
  dayOffset = DEFAULT_CUTOFF_DAY_OFFSET
): boolean {
  if (!submittedAt) return false;
  const dateStr = typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  return isReportLate(dateStr, new Date(submittedAt), cutoff, dayOffset);
}

/**
 * The report date (YYYY-MM-DD, IST) a member is filling at `now`. With a next-day cut-off, the
 * previous day's report stays open until the cut-off — e.g. at 1:30 AM on Oct 8 it's still Oct 7's.
 */
export function getOpenReportDateStr(
  now: Date = new Date(),
  cutoff = DEFAULT_REPORT_CUTOFF,
  dayOffset = DEFAULT_CUTOFF_DAY_OFFSET
): string {
  const [hh, mm] = cutoff.split(":").map(Number);
  // Shift so "IST minus (cut-off time + offset days)" lands on the report date.
  const shiftMinutes = IST_OFFSET_MINUTES - (dayOffset > 0 ? hh * 60 + mm : 0);
  return new Date(now.getTime() + shiftMinutes * 60_000).toISOString().slice(0, 10);
}

/** ("06:00", 1) → "6:00 AM next day"; ("18:00", 0) → "6:00 PM" */
export function formatCutoffLabel(cutoff = DEFAULT_REPORT_CUTOFF, dayOffset = DEFAULT_CUTOFF_DAY_OFFSET): string {
  const [hh, mm] = cutoff.split(":").map(Number);
  const suffix = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const time = `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
  return dayOffset > 0 ? `${time} next day` : time;
}

export type ReportTaskRow = {
  id?: string;
  text: string;
  priority: string | null;
  completed: boolean;
  addedAfterReview?: boolean;
};

/**
 * The report's planned tasks kept in step with that day's DSM tasks (matched by trimmed,
 * case-insensitive text — the two aren't linked by id). The DSM is the source of truth for which
 * tasks exist and their order; the report keeps its own ticks, ids and priority for tasks it already
 * had. Tasks added to the DSM since the report was opened / saved are appended (unticked); tasks no
 * longer in the DSM (deleted or renamed there) are dropped — except rows added after review, which
 * only live on the report. With no DSM tasks at all, the report is left as is.
 */
export function syncReportTasksWithDsm(
  current: ReportTaskRow[],
  dsmTasks: { text: string; priority: string | null }[]
): ReportTaskRow[] {
  if (dsmTasks.length === 0) return current;
  const norm = (s: string) => s.trim().toLowerCase();

  const byText = new Map<string, ReportTaskRow>();
  for (const t of current) {
    const key = norm(t.text);
    if (key && !byText.has(key)) byText.set(key, t);
  }

  const seen = new Set<string>();
  const synced: ReportTaskRow[] = [];
  for (const dsm of dsmTasks) {
    const key = norm(dsm.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const existing = byText.get(key);
    synced.push(
      existing
        ? { ...existing, priority: existing.priority ?? dsm.priority }
        : { text: dsm.text, priority: dsm.priority, completed: false }
    );
  }
  for (const t of current) {
    if (t.addedAfterReview && !seen.has(norm(t.text))) synced.push(t);
  }
  return synced;
}

/**
 * A stored recordingUrl worth showing/pre-filling. Reports saved while the (removed) in-app recorder
 * existed hold an internal "/api/report-recordings/…" path that no longer resolves — treat those as empty.
 */
export function usableRecordingUrl(stored: string | null | undefined): string {
  const value = stored?.trim() ?? "";
  return /^https?:\/\//i.test(value) ? value : "";
}

export type RecordingUrlCheck = { ok: true; url: string } | { ok: false; error: string };

/** Validates a pasted recording link: must be an https URL on an allow-listed host. */
export function validateRecordingUrl(
  raw: string | null | undefined,
  allowedHosts: string[] = DEFAULT_RECORDING_HOSTS
): RecordingUrlCheck {
  const value = raw?.trim() ?? "";
  if (!value) return { ok: false, error: "Paste the link to your screen recording before submitting." };

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, error: "That doesn't look like a valid link." };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "The recording link must start with https://." };
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
  if (!allowed) {
    return {
      ok: false,
      error: `Recording links must be shared from Zoho (Cliq / WorkDrive). Allowed: ${allowedHosts.join(", ")}.`,
    };
  }
  return { ok: true, url: parsed.toString() };
}

/** 135 → "2h 15m" */
export function formatMinutes(total: number): string {
  if (!total || total <= 0) return "0m";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export type CliqReportPayload = {
  memberName: string;
  dateStr: string;
  completedTaskCount: number;
  plannedTaskCount: number;
  totalLoggedMinutes: number;
  resultOfDay: string | null;
  dayFeedback: string | null;
  suggestions: string | null;
  recordingUrl: string | null;
  isLate: boolean;
  isUpdate: boolean;
  reportUrl: string | null;
};

/** Builds the Zoho Cliq incoming-webhook message body ({ text }). */
export function buildCliqReportMessage(p: CliqReportPayload): { text: string } {
  const header = `${p.isUpdate ? "Updated report" : "End-of-day report"}: *${p.memberName}*, ${p.dateStr}${p.isLate ? " (LATE)" : ""}`;
  const lines = [
    header,
    `Tasks: ${p.completedTaskCount}/${p.plannedTaskCount} done · Time logged: ${formatMinutes(p.totalLoggedMinutes)}`,
  ];
  if (p.resultOfDay) lines.push(`Outcome: ${p.resultOfDay}`);
  if (p.dayFeedback) lines.push(`How was the day: ${p.dayFeedback}`);
  if (p.suggestions) lines.push(`Feedback / suggestions: ${p.suggestions}`);
  lines.push(p.recordingUrl ? `Recording: ${p.recordingUrl}` : "Recording: (missing)");
  if (p.reportUrl) lines.push(`Full report: ${p.reportUrl}`);
  return { text: lines.join("\n") };
}
