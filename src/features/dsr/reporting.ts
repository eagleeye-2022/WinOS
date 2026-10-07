// Pure helpers for the end-of-day Report (formerly DSR): cut-off/late calculation, recording-link
// validation and the Zoho Cliq message body. Kept free of DB/auth imports so they're unit-testable
// and safe to import from client components.

const IST_OFFSET_MINUTES = 5 * 60 + 30;

/** Default end-of-day report cut-off (IST, 24h). Override with REPORT_CUTOFF_HHMM. */
export const DEFAULT_REPORT_CUTOFF = "18:00";

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

export function getAllowedRecordingHosts(): string[] {
  const raw = process.env.REPORT_RECORDING_ALLOWED_HOSTS;
  if (!raw?.trim()) return DEFAULT_RECORDING_HOSTS;
  return raw.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
}

/** Server-resolved settings handed to the client-side report form/modal. */
export type ReportConfig = {
  /** "18:00" */
  cutoff: string;
  /** "6:00 PM" */
  cutoffLabel: string;
  allowedHosts: string[];
};

/** Call on the server: env vars aren't available to client components. */
export function getReportConfig(): ReportConfig {
  const cutoff = getReportCutoff();
  return { cutoff, cutoffLabel: formatCutoffLabel(cutoff), allowedHosts: getAllowedRecordingHosts() };
}

/** The cut-off instant (UTC) for a report dated `dateStr` (YYYY-MM-DD), interpreted in IST. */
export function getCutoffInstant(dateStr: string, cutoff = DEFAULT_REPORT_CUTOFF): Date {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const [hh, mm] = cutoff.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MINUTES * 60_000);
}

/** True when `submittedAt` falls after the report date's cut-off. */
export function isReportLate(dateStr: string, submittedAt: Date, cutoff = DEFAULT_REPORT_CUTOFF): boolean {
  return submittedAt.getTime() > getCutoffInstant(dateStr, cutoff).getTime();
}

/** "18:00" → "6:00 PM" */
export function formatCutoffLabel(cutoff = DEFAULT_REPORT_CUTOFF): string {
  const [hh, mm] = cutoff.split(":").map(Number);
  const suffix = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
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
