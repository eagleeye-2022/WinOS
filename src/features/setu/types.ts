// Setu (BNI networking CRM) domain types. The design phase runs on mock data
// (`data/mock-setu.ts`); these shapes are what the Prisma models will later back.

export type PipelineStageId =
  | "PROSPECT"
  | "DISCOVERY"
  | "PROPOSAL"
  | "ESTIMATE_SENT"
  | "CLIENT_MEET_1"
  | "CLIENT_MEET_2"
  | "NEGOTIATION"
  | "AGREEMENT"
  | "WON"
  | "ON_HOLD"
  | "LOST"
  | "OPPORTUNITY";

export type MeetingType = "ONE_TO_ONE" | "CHAPTER" | "EVENT";

/** Where a prospect entered the pipeline. */
export type ProspectSource = "WHATSAPP_BOT" | "MEETING_121" | "MANUAL";

export interface MeetingNote {
  id: string;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  text: string;
}

export interface MeetingTodo {
  id: string;
  text: string;
  done: boolean;
}

export interface Meeting121 {
  id: string;
  memberName: string;
  business: string;
  /** Who connected us ("Co Ankur Ji"); empty when it was a direct BNI contact. */
  connectedVia: string;
  phone: string;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  type: MeetingType;
  refsReceived: number;
  refsGiven: number;
  followUps: number;
  /** Names of referrals received in this meeting that are not yet prospects. */
  pendingReferralNames: string[];
  /** Prospects created from this meeting's referrals (or the member themself). */
  prospectIds: string[];
  notes: MeetingNote[];
  todos: MeetingTodo[];
  capturedViaBot: boolean;
}

export interface Prospect {
  id: string;
  name: string;
  business: string;
  connectedVia: string;
  phone: string;
  email: string;
  stage: PipelineStageId;
  source: ProspectSource;
  /** Meeting the prospect came from when `source` is MEETING_121. */
  meetingId?: string;
  /** Short status line shown on the Kanban card ("Follow up 1 Jul"). */
  remark: string;
  /** Expected deal value in INR, if estimated. */
  value?: number;
  /** ISO date (yyyy-mm-dd) of the last stage change / touch. */
  updatedAt: string;
}

export type ReferralDirection = "RECEIVED" | "GIVEN";
export type ReferralStatus = "OPEN" | "CONVERTED" | "WON" | "LOST";

export interface Referral {
  id: string;
  direction: ReferralDirection;
  /** The BNI member who gave (RECEIVED) or received (GIVEN) the referral. */
  memberName: string;
  /** The referred person / business. */
  referralName: string;
  service: string;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  status: ReferralStatus;
  meetingId?: string;
  prospectId?: string;
}

export type ContactKind = "MEMBER" | "PROSPECT";

/** A row in the Contacts view — derived from meetings (members) and prospects. */
export interface SetuContact {
  id: string;
  kind: ContactKind;
  name: string;
  business: string;
  phone: string;
  connectedVia: string;
  stage?: PipelineStageId;
  source?: ProspectSource;
  refsReceived?: number;
  href: string;
}

export interface BotCapture {
  id: string;
  /** ISO datetime. */
  at: string;
  kind: "CARD" | "NOTES" | "COMMAND";
  summary: string;
  routedTo: "MEETING" | "PROSPECT" | "NONE";
  ok: boolean;
}

export interface SetuStats {
  pipelineHealth: number;
  prospects: number;
  meetings: number;
  refsReceived: number;
  refsGiven: number;
  won: number;
}
