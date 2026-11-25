// Setu domain types — the view shapes server/data.ts maps the Crm* Prisma rows into. The BNI
// networking layer (members, 121s, referrals, the 12-stage pipeline) sits on top: see bni.ts.
import type { BniTags } from "./bni";

/** The seven columns of the Tasks board, in order. */
export type DealStage =
  | "LEAD"
  | "MEETING"
  | "DISCUSSION"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "CLOSED_WON"
  | "CLOSED_LOST";

/**
 * One lead / deal. A lead becomes a deal (gets a `dealCode`) when it first reaches Proposal;
 * the board shows one card per record, in the column of its current stage.
 */
export interface Deal {
  id: string;
  /** "LD-2026-0042" — assigned on creation. */
  leadCode: string;
  /** "DEAL-2026-0018" — assigned the first time the record reaches Proposal. */
  dealCode?: string;
  /** Deal title ("Website Development Proposal"); empty for a fresh lead. */
  title: string;
  company: string;
  contactName: string;
  /** "Decision Maker (VP Engineering)". */
  contactRole: string;
  phone: string;
  email: string;
  location: string;
  /** Who brought the lead in (a person's name, "Website", …). */
  source: string;
  stage: DealStage;
  /** Rep who owns the record. */
  ownerId: string;
  ownerName: string;
  /** Deal value in INR (proposal value / negotiated value / closed value by stage). */
  value?: number;
  /** Proposal revision shown on Proposal cards ("V2"). */
  proposalVersion?: number;
  /**
   * The one-line status shown on the card. Its meaning follows the stage: a note for
   * Lead / Discussion, the client's request in Negotiation, the reason in Closed Lost.
   */
  remark: string;
  /** ISO date the next action is due (filters by "Due Date"; a scheduled meeting also counts). */
  dueDate?: string;
  /** ISO date the deal was closed (won or lost). */
  closedAt?: string;
  /** Filled from the Closed Won tab. */
  won?: DealWonDetails;
  /** Filled from the Closed Lost tab. */
  lost?: DealLostDetails;
  /** ISO datetime of the last change. */
  updatedAt: string;
  /**
   * BNI tags (member / opportunity, origin, sub-stage, on hold) — decoded from the stored
   * contactRole prefix by server/data.ts, which leaves `contactRole` clean. Absent = plain prospect.
   */
  bni?: BniTags;
}

/** Notes, Discussions and Negotiation updates share one shape; each tab shows its own feed. */
export type NoteCategory = "NOTE" | "DISCUSSION" | "NEGOTIATION";

/** A file attached to a proposal or a won deal (`url` = /api/uploads/<stored name>). */
export interface DealFile {
  id: string;
  name: string;
  /** Bytes. */
  size: number;
  url?: string;
}

// ── Proposals ─────────────────────────────────────────────────────────────────

/** DRAFT = being written (one per deal at most); ACTIVE = the offer with the client; SUPERSEDED = older versions. */
export type ProposalStatus = "DRAFT" | "ACTIVE" | "SUPERSEDED";

export interface ProposalVersion {
  id: string;
  dealId: string;
  /** 1, 2, 3 … ("V3"). */
  version: number;
  title: string;
  /** Commercial quote in INR. */
  value: number;
  /** Why this revision (V1: the initial pitch). */
  reason: string;
  authorId: string;
  authorName: string;
  authorRole?: string;
  /** ISO datetime the version was created / published. */
  createdAt: string;
  status: ProposalStatus;
  /** How it reached the client ("DocuSign", "Email"). */
  sentVia?: string;
  attachment?: DealFile;
}

// ── Closure ───────────────────────────────────────────────────────────────────

export interface DealWonDetails {
  finalValue: number;
  /** ISO date. */
  closedDate: string;
  advanceReceived: number;
  contractTerm: string;
  paymentTerms: string;
  documents: DealFile[];
}

export interface DealLostDetails {
  lostValue: number;
  primaryReason: string;
  secondaryFactor: string;
  /** ISO date. */
  closedDate: string;
  analysis: string;
  /** ISO date to reach out again. */
  reengageDate?: string;
  /** "Q4 Budget Cycle". */
  reengageNote: string;
  /** Keep the contact on the newsletter / nurture list. */
  keepNurturing: boolean;
}

export interface DealNote {
  id: string;
  dealId: string;
  category: NoteCategory;
  title: string;
  body: string;
  pinned: boolean;
  authorId: string;
  authorName: string;
  /** ISO datetime. */
  createdAt: string;
}

export interface DealTimeLog {
  id: string;
  dealId: string;
  userId: string;
  employeeName: string;
  reason: string;
  /** ISO datetimes. */
  startedAt: string;
  endedAt: string;
}

// ── Negotiations ──────────────────────────────────────────────────────────────

/** One client request in the multi-level request list ("Level 1 — 10% discount on 2-yr renewal"). */
export interface NegotiationRequest {
  id: string;
  dealId: string;
  /** 1-based; requests are listed by level. */
  level: number;
  text: string;
  requestedBy: string;
}

// ── Calls ─────────────────────────────────────────────────────────────────────

export type CallDirection = "OUTBOUND" | "INBOUND";
export type CallOutcome = "CONNECTED" | "INTERESTED" | "QUALIFIED" | "COMPLETED" | "NO_ANSWER";

export interface DealCall {
  id: string;
  dealId: string;
  title: string;
  direction: CallDirection;
  outcome: CallOutcome;
  /** ISO datetimes. */
  startedAt: string;
  endedAt: string;
  repId: string;
  repName: string;
  /** "Lead Architect" — shown as "Rep: Arjun (Lead Architect)". */
  repRole?: string;
  contactName: string;
  /** "Client VP" — shown as "Rahul Sharma (Client VP)". */
  contactRole?: string;
  summary: string;
  /** Link to the call recording, when there is one ("With Audio" filter). */
  recordingUrl?: string;
}

// ── Meetings ──────────────────────────────────────────────────────────────────

/** Online channels have a join link; IN_OFFICE / CLIENT_LOCATION have a `location`. */
export type MeetingChannel = "GOOGLE_MEET" | "ZOOM" | "TEAMS" | "ONLINE" | "IN_OFFICE" | "CLIENT_LOCATION";
/** UPCOMING is shown as "Scheduled". DRAFT = saved from the schedule page but not sent. */
export type MeetingStatus = "DRAFT" | "UPCOMING" | "COMPLETED" | "CANCELLED";
export type MeetingReminder = "30m" | "15m" | "1h" | "1d";
export type MeetingRsvp = "PENDING" | "ACCEPTED" | "DECLINED";

export interface MeetingAttendee {
  id: string;
  /** Set for internal (team) attendees. */
  userId?: string;
  name: string;
  /** "VP Eng (Client)", "Lead Architect". */
  role?: string;
  email?: string;
  company?: string;
  /** Someone outside the team (client contact or guest) — gets a calendar invite by email. */
  external: boolean;
  /** Where they were picked from (drives the badge: Lead / External Guest / Internal). */
  source?: "LEAD" | "DEAL" | "GUEST" | "TEAM";
  rsvp?: MeetingRsvp;
  /** Set when the meeting is completed. */
  attended?: boolean;
}

/** One line of a meeting's activity & audit history. */
export interface MeetingEvent {
  id: string;
  /** ISO datetime. */
  at: string;
  title: string;
  detail: string;
  tone: "blue" | "green" | "amber" | "red";
}

export interface DealMeeting {
  id: string;
  dealId: string;
  title: string;
  /** "Technical Deep Dive", "Discovery Demo". */
  type: string;
  /** ISO datetimes. */
  startAt: string;
  endAt: string;
  hostId: string;
  hostName: string;
  hostRole?: string;
  channel: MeetingChannel;
  /** Join link for online channels. */
  link?: string;
  /** Address / room for in-office and client-location meetings. */
  location?: string;
  /** Agenda & discussion points — rich-text HTML (older entries may be plain text). */
  agenda: string;
  attendees: MeetingAttendee[];
  status: MeetingStatus;
  reminder: MeetingReminder;
  /** Discussion summary (rich-text HTML) logged when the meeting is completed. */
  summary?: string;
  recordingUrl?: string;
  /** Newest last. */
  history: MeetingEvent[];
}

/** The one running timer (a rep times one deal at a time). */
export interface ActiveTimer {
  dealId: string;
  userId: string;
  employeeName: string;
  /** ISO datetime. */
  startedAt: string;
}

/** What the Create Lead / Edit Deal forms collect. */
export interface DealInput {
  company: string;
  contactName: string;
  contactRole: string;
  phone: string;
  email: string;
  location: string;
  source: string;
  stage: DealStage;
  title: string;
  value?: number;
  remark: string;
}

/** A WinOS user who can own deals, host meetings, log calls… */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  title?: string;
}

/** Everything the Setu pages read, loaded once per request by the Setu layout. */
export interface SetuSnapshot {
  me: TeamMember;
  team: TeamMember[];
  deals: Deal[];
  notes: DealNote[];
  timeLogs: DealTimeLog[];
  activeTimer: ActiveTimer | null;
  requests: NegotiationRequest[];
  calls: DealCall[];
  meetings: DealMeeting[];
  proposals: ProposalVersion[];
}
