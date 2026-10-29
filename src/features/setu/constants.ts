import type { MeetingType, PipelineStageId, ProspectSource } from "./types";

export interface PipelineStage {
  id: PipelineStageId;
  label: string;
  /** Short label for tight spots (column headers, badges). */
  short: string;
  /** Tailwind classes for the stage dot. */
  dot: string;
  /** Closed stages sit after the active funnel and are excluded from "in progress" counts. */
  closed?: boolean;
}

/** The 12 Setu pipeline stages, in board order. */
export const PIPELINE_STAGES: readonly PipelineStage[] = [
  { id: "PROSPECT", label: "Prospect", short: "Prospect", dot: "bg-blue-500" },
  { id: "DISCOVERY", label: "Discovery Meeting", short: "Discovery", dot: "bg-orange-500" },
  { id: "PROPOSAL", label: "Estimation / Proposal", short: "Proposal", dot: "bg-violet-500" },
  { id: "ESTIMATE_SENT", label: "Estimate Sent", short: "Estimate Sent", dot: "bg-cyan-600" },
  { id: "CLIENT_MEET_1", label: "Client Meet 1", short: "Meet 1", dot: "bg-sky-600" },
  { id: "CLIENT_MEET_2", label: "Client Meet 2", short: "Meet 2", dot: "bg-blue-700" },
  { id: "NEGOTIATION", label: "Negotiation", short: "Negotiation", dot: "bg-amber-600" },
  { id: "AGREEMENT", label: "Agreement", short: "Agreement", dot: "bg-emerald-600" },
  { id: "WON", label: "Deal Won", short: "Won", dot: "bg-green-600", closed: true },
  { id: "ON_HOLD", label: "On Hold", short: "On Hold", dot: "bg-slate-500", closed: true },
  { id: "LOST", label: "Lost", short: "Lost", dot: "bg-red-600", closed: true },
  { id: "OPPORTUNITY", label: "Mixed / Opportunity", short: "Opportunity", dot: "bg-purple-500" },
];

export const STAGE_BY_ID: Record<PipelineStageId, PipelineStage> = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.id, s])
) as Record<PipelineStageId, PipelineStage>;

export const MEETING_TYPE_LABEL: Record<MeetingType, string> = {
  ONE_TO_ONE: "121 Meeting",
  CHAPTER: "Chapter Meeting",
  EVENT: "Networking Event",
};

export const SOURCE_LABEL: Record<ProspectSource, string> = {
  WHATSAPP_BOT: "WhatsApp Bot",
  MEETING_121: "121 Meeting",
  MANUAL: "Manual",
};


/** The BNI chapter shown in the Setu sidebar / page headers. */
export const SETU_CHAPTER = { name: "Indore Pinnacle", membership: "Active Member" };
