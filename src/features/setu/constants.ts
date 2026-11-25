import type { ElementType } from "react";
import { BadgeCheck, CalendarDays, CircleX, FileText, Handshake, MessagesSquare, UserRoundSearch } from "lucide-react";
import type { CallDirection, CallOutcome, DealStage, MeetingChannel, MeetingReminder, MeetingStatus } from "./types";

/** The team's BNI chapter (shown on the Setu header). */
export const BNI_CHAPTER = { name: "Indore Pinnacle", status: "Active Member" } as const;

export interface StageConfig {
  id: DealStage;
  /** Column header ("LEAD"). */
  label: string;
  /** Filter-chip label ("Leads"). */
  chip: string;
  icon: ElementType;
  /** Tailwind classes for the column header's icon tile. */
  tile: string;
  /** Tailwind classes for the count badge. */
  count: string;
  /** Closed stages are excluded from "in motion" totals. */
  closed?: boolean;
}

/** The seven Tasks-board columns, in board order. */
export const DEAL_STAGES: readonly StageConfig[] = [
  { id: "LEAD", label: "Lead", chip: "Leads", icon: UserRoundSearch, tile: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400", count: "bg-[var(--setu-soft)] text-[var(--setu-text-2)]" },
  { id: "MEETING", label: "Meeting", chip: "Meetings", icon: CalendarDays, tile: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400", count: "bg-[var(--setu-soft)] text-[var(--setu-text-2)]" },
  { id: "DISCUSSION", label: "Discussions", chip: "Discussions", icon: MessagesSquare, tile: "bg-blue-600 text-white", count: "bg-[var(--setu-soft)] text-[var(--setu-text-2)]" },
  { id: "PROPOSAL", label: "Proposal", chip: "Proposals", icon: FileText, tile: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400", count: "bg-[var(--setu-soft)] text-[var(--setu-text-2)]" },
  { id: "NEGOTIATION", label: "Negotiation", chip: "Negotiations", icon: Handshake, tile: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400", count: "bg-[var(--setu-soft)] text-[var(--setu-text-2)]" },
  { id: "CLOSED_WON", label: "Closed Won", chip: "Won", icon: BadgeCheck, tile: "bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-400", count: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400", closed: true },
  { id: "CLOSED_LOST", label: "Closed Lost", chip: "Lost", icon: CircleX, tile: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400", count: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400", closed: true },
];

export const STAGE_BY_ID: Record<DealStage, StageConfig> = Object.fromEntries(DEAL_STAGES.map((s) => [s.id, s])) as Record<
  DealStage,
  StageConfig
>;

export const STAGE_IDS: readonly DealStage[] = DEAL_STAGES.map((s) => s.id);

/** Badge colours for the stage pill on the deal header ("● Negotiation Stage"). */
export const STAGE_BADGE: Record<DealStage, string> = {
  LEAD: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
  MEETING: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300",
  DISCUSSION: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300",
  PROPOSAL: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300",
  NEGOTIATION: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  CLOSED_WON: "border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300",
  CLOSED_LOST: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
};

export const STAGE_DOT: Record<DealStage, string> = {
  LEAD: "bg-blue-500",
  MEETING: "bg-violet-500",
  DISCUSSION: "bg-sky-500",
  PROPOSAL: "bg-indigo-500",
  NEGOTIATION: "bg-amber-500",
  CLOSED_WON: "bg-green-500",
  CLOSED_LOST: "bg-red-500",
};

// ── Calls ─────────────────────────────────────────────────────────────────────

export const CALL_OUTCOME: Record<CallOutcome, { label: string; tone: string }> = {
  CONNECTED: { label: "Connected", tone: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" },
  INTERESTED: { label: "Interested", tone: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" },
  QUALIFIED: { label: "Qualified", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  COMPLETED: { label: "Completed", tone: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300" },
  NO_ANSWER: { label: "No Answer", tone: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
};

export const CALL_DIRECTION: Record<CallDirection, { label: string; tone: string }> = {
  OUTBOUND: { label: "Outbound", tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" },
  INBOUND: { label: "Inbound", tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
};

// ── Meetings ──────────────────────────────────────────────────────────────────

export const MEETING_CHANNEL_LABEL: Record<MeetingChannel, string> = {
  GOOGLE_MEET: "Google Meet",
  ZOOM: "Zoom",
  TEAMS: "Microsoft Teams",
  ONLINE: "Online",
  IN_OFFICE: "In-office",
  CLIENT_LOCATION: "Client Location",
};

export const isOnlineChannel = (c: MeetingChannel) => c !== "IN_OFFICE" && c !== "CLIENT_LOCATION";

/** The schedule page's three meeting types. */
export type MeetingMode = "ONLINE" | "IN_OFFICE" | "CLIENT_LOCATION";

export const MEETING_MODES: { id: MeetingMode; label: string; hint: string }[] = [
  { id: "ONLINE", label: "Online Meeting", hint: "External Video Room" },
  { id: "IN_OFFICE", label: "In-office", hint: "WinOS Corporate HQ" },
  { id: "CLIENT_LOCATION", label: "Client Location", hint: "On-site Consultation" },
];

export const modeOfChannel = (c: MeetingChannel): MeetingMode => (isOnlineChannel(c) ? "ONLINE" : c);

/** Online channel from the join link's host. */
export function channelFromLink(link: string): MeetingChannel {
  const l = link.toLowerCase();
  if (l.includes("meet.google.")) return "GOOGLE_MEET";
  if (l.includes("zoom.")) return "ZOOM";
  if (l.includes("teams.microsoft.") || l.includes("teams.live.")) return "TEAMS";
  return "ONLINE";
}

export const MEETING_STATUS: Record<MeetingStatus, { label: string; tone: string; dot: string }> = {
  DRAFT: { label: "Draft", tone: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300", dot: "bg-slate-400" },
  UPCOMING: { label: "Scheduled", tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300", dot: "bg-blue-600" },
  COMPLETED: { label: "Completed", tone: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400", dot: "bg-green-500" },
  CANCELLED: { label: "Cancelled", tone: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400", dot: "bg-red-500" },
};

export const MEETING_REMINDER_LABEL: Record<MeetingReminder, string> = {
  "30m": "30 minutes before",
  "15m": "15 minutes before",
  "1h": "1 hour before",
  "1d": "1 day before",
};

export const MEETING_REMINDERS: readonly MeetingReminder[] = ["30m", "15m", "1h", "1d"];

export const LOSS_REASONS = [
  "Budget Constraints & Fiscal Freeze",
  "Lost to Competitor",
  "Pricing Too High",
  "Scope / Timeline Mismatch",
  "No Decision / Went Silent",
  "Chose In-house Build",
  "Other",
] as const;

/** Short form shown on the summary card ("Budget Freeze"). */
export const LOSS_REASON_SHORT: Record<string, string> = {
  "Budget Constraints & Fiscal Freeze": "Budget Freeze",
  "Lost to Competitor": "Competitor",
  "Pricing Too High": "Pricing",
  "Scope / Timeline Mismatch": "Scope Mismatch",
  "No Decision / Went Silent": "No Decision",
  "Chose In-house Build": "In-house Build",
};

export const CONTRACT_TERMS = [
  "1-Year Term",
  "2-Year MSA Term (Standard Enterprise)",
  "3-Year Enterprise Term",
  "Project-based (One-time)",
  "Monthly Retainer",
] as const;

/** Proposal / closing-document uploads. */
export const UPLOAD_ACCEPT = ".pdf,.doc,.docx";
export const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

/** Level badge colours for negotiation requests (cycles after 4). */
export const LEVEL_TONES = [
  "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
  "border-green-300 bg-green-50 text-green-700 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-300",
  "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300",
  "border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-500/40 dark:bg-pink-500/10 dark:text-pink-300",
];
