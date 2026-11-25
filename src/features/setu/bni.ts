import type { Deal, DealCall, DealMeeting, DealNote, DealStage } from "./types";
import { isoDate, plainText } from "./utils";

// Setu's BNI-networking model (121 Meetings → Referrals → Sales Pipeline, WhatsApp capture,
// Contacts) on top of the existing Crm* tables — no schema change. Pure, unit-tested
// (src/__tests__/unit/setu-bni.test.ts). How each concept is stored:
//
// • BNI member (the person you hold 121s with) — a CrmDeal tagged `member`.
// • Prospect — a CrmDeal (untagged, or tagged `bot` / `121` for where it came from).
// • Mixed / Opportunity card (a campaign, a pitch deck…) — a CrmDeal tagged `opp`.
//   The tags live in a "[bni:…]" prefix of CrmDeal.contactRole; server/data.ts strips it into
//   `Deal.bni`, so the UI never sees the prefix.
// • The 12 pipeline stages — CrmDeal.stage (7 values) plus a sub-stage tag (`cm1`, `cm2`, `agr`)
//   and an On Hold flag (`hold`).
// • 121 meeting — a CrmMeeting on the member with type "121 Meeting" / "Chapter Meeting" /
//   "Networking Event"; its agenda holds the meeting notes.
// • Referrals and to-dos — CrmNote rows on the member whose title starts with "bni:"
//   (`bni:ref-in`, `bni:ref-in>{prospectId}` once converted, `bni:ref-out`, `bni:todo`,
//   `bni:todo-done`). They're hidden from the deal Notes tab.
// • Call notes ("Call Now") — CrmCall rows on the member.

/** What a BNI server action wrote, for the client store to merge. */
export interface BniPatch {
  deals: Deal[];
  notes: DealNote[];
  meetings: DealMeeting[];
  removedNoteIds: string[];
}

// ── Record tags ───────────────────────────────────────────────────────────────

export type BniKind = "PROSPECT" | "MEMBER" | "OPPORTUNITY";
export type BniOrigin = "DIRECT" | "BOT" | "121";
export type BniSubStage = "CLIENT_MEET_1" | "CLIENT_MEET_2" | "AGREEMENT";

export interface BniTags {
  kind: BniKind;
  origin: BniOrigin;
  /** Paused (On Hold column) — the record keeps its underlying stage. */
  hold: boolean;
  sub?: BniSubStage;
}

export const DEFAULT_TAGS: BniTags = { kind: "PROSPECT", origin: "DIRECT", hold: false };

const TAG_RE = /^\[bni:([a-z0-9,-]*)\]\s?/;
const SUB_TOKEN: Record<BniSubStage, string> = { CLIENT_MEET_1: "cm1", CLIENT_MEET_2: "cm2", AGREEMENT: "agr" };
const TOKEN_SUB: Record<string, BniSubStage> = { cm1: "CLIENT_MEET_1", cm2: "CLIENT_MEET_2", agr: "AGREEMENT" };

/** Stored contactRole → the visible role + the BNI tags. */
export function decodeRole(raw: string): { role: string; tags: BniTags } {
  const m = TAG_RE.exec(raw ?? "");
  if (!m) return { role: raw ?? "", tags: { ...DEFAULT_TAGS } };
  const tokens = m[1].split(",").filter(Boolean);
  const tags: BniTags = {
    kind: tokens.includes("member") ? "MEMBER" : tokens.includes("opp") ? "OPPORTUNITY" : "PROSPECT",
    origin: tokens.includes("bot") ? "BOT" : tokens.includes("121") ? "121" : "DIRECT",
    hold: tokens.includes("hold"),
  };
  const sub = tokens.map((t) => TOKEN_SUB[t]).find(Boolean);
  if (sub) tags.sub = sub;
  return { role: raw.slice(m[0].length), tags };
}

/** Visible role + tags → what is stored in contactRole (no prefix for a plain direct prospect). */
export function encodeRole(role: string, tags: BniTags): string {
  const tokens: string[] = [];
  if (tags.kind === "MEMBER") tokens.push("member");
  if (tags.kind === "OPPORTUNITY") tokens.push("opp");
  if (tags.origin === "BOT") tokens.push("bot");
  if (tags.origin === "121") tokens.push("121");
  if (tags.hold) tokens.push("hold");
  if (tags.sub) tokens.push(SUB_TOKEN[tags.sub]);
  const clean = decodeRole(role).role.trim();
  return tokens.length ? `[bni:${tokens.join(",")}]${clean ? ` ${clean}` : ""}` : clean;
}

/** A Deal's tags (records loaded before tagging existed are plain prospects). */
export const tagsOf = (deal: Pick<Deal, "bni">): BniTags => deal.bni ?? DEFAULT_TAGS;
export const isMember = (deal: Pick<Deal, "bni">) => tagsOf(deal).kind === "MEMBER";
export const isOpportunity = (deal: Pick<Deal, "bni">) => tagsOf(deal).kind === "OPPORTUNITY";
/** On the Sales Pipeline board (prospects + opportunity cards, not members). */
export const isPipelineRecord = (deal: Pick<Deal, "bni">) => !isMember(deal);

// ── The 12 pipeline stages ────────────────────────────────────────────────────

export type BniStage =
  | "PROSPECT"
  | "DISCOVERY"
  | "ESTIMATION"
  | "ESTIMATE_SENT"
  | "CLIENT_MEET_1"
  | "CLIENT_MEET_2"
  | "NEGOTIATION"
  | "AGREEMENT"
  | "WON"
  | "ON_HOLD"
  | "LOST"
  | "OPPORTUNITY";

export interface BniStageConfig {
  id: BniStage;
  /** Column header. */
  label: string;
  /** Tailwind classes for the stage dot. */
  dot: string;
  /** Column header tint (Prospect / Won / Lost stand out, as in the design). */
  header?: string;
  /** Card tint for closed columns. */
  card?: string;
  /** Pill colours (stage tags on 121 cards, contacts, the deal header). */
  pill: string;
}

export const BNI_STAGES: readonly BniStageConfig[] = [
  { id: "PROSPECT", label: "Prospect", dot: "bg-blue-600", header: "bg-blue-50 dark:bg-blue-500/10", pill: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" },
  { id: "DISCOVERY", label: "Discovery Mtg", dot: "bg-orange-600", pill: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300" },
  { id: "ESTIMATION", label: "Est. / Proposal", dot: "bg-violet-600", pill: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" },
  { id: "ESTIMATE_SENT", label: "Estimate Sent", dot: "bg-cyan-600", pill: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300" },
  { id: "CLIENT_MEET_1", label: "Client Meet 1", dot: "bg-sky-600", pill: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" },
  { id: "CLIENT_MEET_2", label: "Client Meet 2", dot: "bg-blue-700", pill: "bg-blue-50 text-blue-800 dark:bg-blue-500/10 dark:text-blue-300" },
  { id: "NEGOTIATION", label: "Negotiation", dot: "bg-amber-600", pill: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  { id: "AGREEMENT", label: "Agreement", dot: "bg-emerald-600", pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  {
    id: "WON",
    label: "Deal Won",
    dot: "bg-green-600",
    header: "bg-green-50 dark:bg-green-500/10",
    card: "border-green-200 bg-green-50/70 dark:border-green-500/25 dark:bg-green-500/10",
    pill: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  },
  { id: "ON_HOLD", label: "On Hold", dot: "bg-slate-500", pill: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300" },
  {
    id: "LOST",
    label: "Lost",
    dot: "bg-red-600",
    card: "border-red-200 bg-red-50/70 dark:border-red-500/25 dark:bg-red-500/10",
    pill: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  },
  { id: "OPPORTUNITY", label: "Mixed / Opport.", dot: "bg-violet-500", pill: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" },
];

export const BNI_STAGE_BY_ID = Object.fromEntries(BNI_STAGES.map((s) => [s.id, s])) as Record<BniStage, BniStageConfig>;
export const BNI_STAGE_IDS: readonly BniStage[] = BNI_STAGES.map((s) => s.id);
export const isBniStage = (v: unknown): v is BniStage => BNI_STAGE_IDS.includes(v as BniStage);

const SUB_BASE: Record<BniSubStage, DealStage> = { CLIENT_MEET_1: "PROPOSAL", CLIENT_MEET_2: "PROPOSAL", AGREEMENT: "NEGOTIATION" };
const ENUM_TO_BNI: Record<DealStage, BniStage> = {
  LEAD: "PROSPECT",
  MEETING: "DISCOVERY",
  DISCUSSION: "ESTIMATION",
  PROPOSAL: "ESTIMATE_SENT",
  NEGOTIATION: "NEGOTIATION",
  CLOSED_WON: "WON",
  CLOSED_LOST: "LOST",
};
const BNI_TO_ENUM: Partial<Record<BniStage, DealStage>> = {
  PROSPECT: "LEAD",
  DISCOVERY: "MEETING",
  ESTIMATION: "DISCUSSION",
  ESTIMATE_SENT: "PROPOSAL",
  CLIENT_MEET_1: "PROPOSAL",
  CLIENT_MEET_2: "PROPOSAL",
  NEGOTIATION: "NEGOTIATION",
  AGREEMENT: "NEGOTIATION",
  WON: "CLOSED_WON",
  LOST: "CLOSED_LOST",
};

/** Which of the 12 columns a record sits in. */
export function bniStageOf(deal: Pick<Deal, "stage" | "bni">): BniStage {
  const t = tagsOf(deal);
  if (t.kind === "OPPORTUNITY") return "OPPORTUNITY";
  if (deal.stage === "CLOSED_WON") return "WON";
  if (deal.stage === "CLOSED_LOST") return "LOST";
  if (t.hold) return "ON_HOLD";
  if (t.sub && SUB_BASE[t.sub] === deal.stage) return t.sub;
  return ENUM_TO_BNI[deal.stage];
}

/** Moving a record to a column: the stored stage + tags to write. */
export function applyBniStage(current: { stage: DealStage; tags: BniTags }, target: BniStage): { stage: DealStage; tags: BniTags } {
  const base: BniTags = { kind: current.tags.kind === "MEMBER" ? "MEMBER" : "PROSPECT", origin: current.tags.origin, hold: false };
  if (target === "OPPORTUNITY") return { stage: "LEAD", tags: { ...base, kind: "OPPORTUNITY" } };
  if (target === "ON_HOLD") {
    const closed = current.stage === "CLOSED_WON" || current.stage === "CLOSED_LOST";
    const keepSub = current.tags.sub && SUB_BASE[current.tags.sub] === current.stage ? current.tags.sub : undefined;
    return { stage: closed ? "LEAD" : current.stage, tags: { ...base, hold: true, ...(keepSub && !closed ? { sub: keepSub } : {}) } };
  }
  const stage = BNI_TO_ENUM[target] as DealStage;
  const sub = target === "CLIENT_MEET_1" || target === "CLIENT_MEET_2" || target === "AGREEMENT" ? target : undefined;
  return { stage, tags: sub ? { ...base, sub } : base };
}

/** A fresh record's stage + tags for a column (the "+ Add" on each column). */
export const stageForNew = (target: BniStage, kind: BniKind, origin: BniOrigin) =>
  applyBniStage({ stage: "LEAD", tags: { kind, origin, hold: false } }, target);

// ── BNI notes (referrals, to-dos) ─────────────────────────────────────────────

export const NOTE_REF_IN = "bni:ref-in";
export const NOTE_REF_OUT = "bni:ref-out";
export const NOTE_TODO = "bni:todo";
export const NOTE_TODO_DONE = "bni:todo-done";

/** Machine notes kept on member records — never shown in the deal Notes tab. */
export const isBniNote = (n: Pick<DealNote, "title">) => n.title.startsWith("bni:");

export interface ReferralDetails {
  /** The referred person / business (received) or who it was given to (given). */
  name: string;
  business: string;
  phone: string;
  /** "Connected via" person, when not the member themself. */
  via: string;
}

export function encodeReferral(r: Partial<ReferralDetails>): string {
  return JSON.stringify({ name: r.name?.trim() ?? "", business: r.business?.trim() ?? "", phone: r.phone?.trim() ?? "", via: r.via?.trim() ?? "" });
}

export function decodeReferral(body: string): ReferralDetails {
  try {
    const v = JSON.parse(body) as Partial<ReferralDetails>;
    if (v && typeof v === "object") return { name: String(v.name ?? ""), business: String(v.business ?? ""), phone: String(v.phone ?? ""), via: String(v.via ?? "") };
  } catch {
    // plain-text body
  }
  return { name: body, business: "", phone: "", via: "" };
}

export const isRefIn = (n: Pick<DealNote, "title">) => n.title === NOTE_REF_IN || n.title.startsWith(`${NOTE_REF_IN}>`);
export const isRefOut = (n: Pick<DealNote, "title">) => n.title === NOTE_REF_OUT;
export const isTodo = (n: Pick<DealNote, "title">) => n.title === NOTE_TODO || n.title === NOTE_TODO_DONE;
/** The prospect a received referral was converted into. */
export const convertedDealId = (n: Pick<DealNote, "title">) => (n.title.startsWith(`${NOTE_REF_IN}>`) ? n.title.slice(NOTE_REF_IN.length + 1) : undefined);

// ── 121 meetings ──────────────────────────────────────────────────────────────

export const MEETING_TYPES = ["121 Meeting", "Chapter Meeting", "Networking Event"] as const;
export type BniMeetingType = (typeof MEETING_TYPES)[number];

/** Human name a meeting is shown under ("121 Meeting · 15 Jul 2026"). */
export const is121Type = (type: string) => (MEETING_TYPES as readonly string[]).includes(type);

export interface MemberSummary {
  member: Deal;
  meetings: DealMeeting[];
  lastMeeting?: DealMeeting;
  refsReceived: number;
  refsGiven: number;
  /** Received referrals not yet turned into prospects. */
  pendingRefs: DealNote[];
  /** Prospects created from this member's referrals. */
  prospects: Deal[];
  openTodos: number;
  todos: DealNote[];
}

/** Everything a 121 card / member dialog shows, for every member, newest activity first. */
export function memberSummaries(deals: Deal[], notes: DealNote[], meetings: DealMeeting[]): MemberSummary[] {
  const byId = new Map(deals.map((d) => [d.id, d]));
  const out: MemberSummary[] = [];
  for (const member of deals) {
    if (!isMember(member)) continue;
    const mine = notes.filter((n) => n.dealId === member.id);
    const refIn = mine.filter(isRefIn);
    const todos = mine.filter(isTodo).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const ms = meetings.filter((m) => m.dealId === member.id).sort((a, b) => b.startAt.localeCompare(a.startAt));
    out.push({
      member,
      meetings: ms,
      lastMeeting: ms[0],
      refsReceived: refIn.length,
      refsGiven: mine.filter(isRefOut).length,
      pendingRefs: refIn.filter((n) => !convertedDealId(n)),
      prospects: refIn.map((n) => byId.get(convertedDealId(n) ?? "")).filter((d): d is Deal => Boolean(d)),
      openTodos: todos.filter((t) => t.title === NOTE_TODO).length,
      todos,
    });
  }
  const last = (s: MemberSummary) => s.lastMeeting?.startAt ?? s.member.updatedAt;
  return out.sort((a, b) => last(b).localeCompare(last(a)));
}

/** Member → prospect map: which 121 a prospect came from ("↑ From 121 Shreshtha"). */
export function prospectSources(deals: Deal[], notes: DealNote[]): Map<string, Deal> {
  const byId = new Map(deals.map((d) => [d.id, d]));
  const map = new Map<string, Deal>();
  for (const n of notes) {
    const id = convertedDealId(n);
    const member = byId.get(n.dealId);
    if (id && member) map.set(id, member);
  }
  return map;
}

export interface TimelineEntry {
  id: string;
  at: string;
  kind: "MEETING" | "NOTE" | "CALL";
  title: string;
  text: string;
}

/** A member's meeting-notes feed: 121s, plain notes and call notes, newest first. */
export function memberTimeline(memberId: string, notes: DealNote[], meetings: DealMeeting[], calls: DealCall[]): TimelineEntry[] {
  const rows: TimelineEntry[] = [
    ...meetings.filter((m) => m.dealId === memberId).map((m) => ({ id: m.id, at: m.startAt, kind: "MEETING" as const, title: m.type, text: plainText(m.summary || m.agenda) })),
    ...notes.filter((n) => n.dealId === memberId && n.category === "NOTE" && !isBniNote(n)).map((n) => ({ id: n.id, at: n.createdAt, kind: "NOTE" as const, title: n.title, text: plainText(n.body) })),
    ...calls.filter((c) => c.dealId === memberId).map((c) => ({ id: c.id, at: c.startedAt, kind: "CALL" as const, title: "Call note", text: plainText(c.summary) })),
  ];
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

// ── Referrals tracker ─────────────────────────────────────────────────────────

export interface ReferralRow {
  id: string;
  direction: "RECEIVED" | "GIVEN";
  /** Member who gave (received) / got (given) the referral. */
  memberId?: string;
  memberName: string;
  details: ReferralDetails;
  status: "PENDING" | "CONVERTED" | "GIVEN";
  /** The prospect it became. */
  prospect?: Deal;
  at: string;
  /** The note behind it (absent for a prospect whose referrer was typed in directly). */
  noteId?: string;
}

/** "Co Raj Pagariya Ji" / "Raj Pagariya" → "Raj Pagariya". */
export const connectorName = (source: string) => source.replace(/^co\.?\s+/i, "").trim();

/**
 * Every referral: received ones logged on members (pending or converted), given ones, and
 * prospects whose "Connected via" was typed directly (e.g. from a visiting card) — newest first.
 */
export function buildReferrals(deals: Deal[], notes: DealNote[]): ReferralRow[] {
  const byId = new Map(deals.map((d) => [d.id, d]));
  const linked = new Set<string>();
  const rows: ReferralRow[] = [];
  for (const n of notes) {
    if (!isRefIn(n) && !isRefOut(n)) continue;
    const member = byId.get(n.dealId);
    if (!member) continue;
    const prospectId = convertedDealId(n);
    const prospect = prospectId ? byId.get(prospectId) : undefined;
    if (prospectId) linked.add(prospectId);
    rows.push({
      id: n.id,
      noteId: n.id,
      direction: isRefIn(n) ? "RECEIVED" : "GIVEN",
      memberId: member.id,
      memberName: member.contactName,
      details: decodeReferral(n.body),
      status: isRefOut(n) ? "GIVEN" : prospect ? "CONVERTED" : "PENDING",
      prospect,
      at: n.createdAt,
    });
  }
  for (const d of deals) {
    if (isMember(d) || isOpportunity(d) || linked.has(d.id) || !connectorName(d.source)) continue;
    rows.push({
      id: `deal-${d.id}`,
      direction: "RECEIVED",
      memberName: connectorName(d.source),
      details: { name: d.contactName, business: d.company === d.contactName ? "" : d.company, phone: d.phone, via: "" },
      status: "CONVERTED",
      prospect: d,
      at: d.updatedAt,
    });
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

// ── Header stats ──────────────────────────────────────────────────────────────

export interface SetuStats {
  /** Share of open prospects that are moving: not on hold and touched in the last 30 days. */
  pipelineHealth: number | null;
  prospects: number;
  meetings121: number;
  refsReceived: number;
  refsGiven: number;
  won: number;
  members: number;
  opportunities: number;
}

export function setuStats(deals: Deal[], notes: DealNote[], meetings: DealMeeting[], today: string): SetuStats {
  const members = new Set(deals.filter(isMember).map((d) => d.id));
  const prospects = deals.filter((d) => !isMember(d) && !isOpportunity(d));
  const open = prospects.filter((d) => d.stage !== "CLOSED_WON" && d.stage !== "CLOSED_LOST");
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const since = cutoff.toISOString().slice(0, 10);
  const moving = open.filter((d) => !tagsOf(d).hold && isoDate(d.updatedAt) >= since).length;
  const referrals = buildReferrals(deals, notes);
  return {
    pipelineHealth: open.length ? Math.round((moving / open.length) * 100) : null,
    prospects: prospects.length,
    meetings121: meetings.filter((m) => members.has(m.dealId)).length,
    refsReceived: referrals.filter((r) => r.direction === "RECEIVED").length,
    refsGiven: referrals.filter((r) => r.direction === "GIVEN").length,
    won: prospects.filter((d) => d.stage === "CLOSED_WON").length,
    members: members.size,
    opportunities: deals.filter(isOpportunity).length,
  };
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export type ContactFilter = "all" | "prospects" | "members" | "referrals" | "won";

export interface BniContact {
  deal: Deal;
  kind: "MEMBER" | "PROSPECT";
  name: string;
  business: string;
  phone: string;
  email: string;
  stage?: BniStage;
  /** From a referral (121 conversion or a typed "Connected via"). */
  fromReferral: boolean;
  refsReceived: number;
  followUp: boolean;
}

/** One card per member and per prospect (opportunity cards aren't people). */
export function buildContacts(deals: Deal[], notes: DealNote[]): BniContact[] {
  const sources = prospectSources(deals, notes);
  const out: BniContact[] = [];
  for (const d of deals) {
    if (isOpportunity(d)) continue;
    const member = isMember(d);
    const mine = member ? notes.filter((n) => n.dealId === d.id) : [];
    out.push({
      deal: d,
      kind: member ? "MEMBER" : "PROSPECT",
      name: d.contactName,
      business: d.company === d.contactName ? "" : d.company,
      phone: d.phone,
      email: d.email,
      stage: member ? undefined : bniStageOf(d),
      fromReferral: !member && (sources.has(d.id) || Boolean(connectorName(d.source))),
      refsReceived: mine.filter(isRefIn).length,
      followUp: mine.some((n) => n.title === NOTE_TODO),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function matchesContactFilter(c: BniContact, f: ContactFilter): boolean {
  if (f === "prospects") return c.kind === "PROSPECT";
  if (f === "members") return c.kind === "MEMBER";
  if (f === "referrals") return c.fromReferral;
  if (f === "won") return c.stage === "WON";
  return true;
}

// ── Inputs (forms → server) ───────────────────────────────────────────────────

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T>(value: T): Checked<T> => ({ ok: true, value });
const fail = <T>(error: string): Checked<T> => ({ ok: false, error });
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A person captured from a meeting, a visiting card or a vCard: most fields may be unknown. */
export interface PersonInput {
  name: string;
  business: string;
  phone: string;
  email: string;
  address: string;
  /** "Connected via (Co.)" — who connected you; blank when direct. */
  via: string;
}

function checkPerson(raw: Partial<PersonInput>, who: string): Checked<PersonInput> {
  const name = str(raw.name, 200);
  if (!name) return fail(`${who} name is required.`);
  const phone = str(raw.phone, 40);
  if (phone && phone.replace(/\D/g, "").length < 10) return fail("Enter a 10-digit phone number (or leave it blank).");
  const email = str(raw.email, 200);
  if (email && !EMAIL_RE.test(email)) return fail("Enter a valid email (or leave it blank).");
  return ok({ name, business: str(raw.business, 200), phone, email, address: str(raw.address, 300), via: connectorName(str(raw.via, 200)) });
}

export interface ProspectInput extends PersonInput {
  kind: "PROSPECT" | "OPPORTUNITY";
  origin: BniOrigin;
  stage: BniStage;
  /** One-line card note ("Follow up 1 Jul"). */
  remark: string;
  /** Service they need ("Web Design & Dev"). */
  need: string;
}

export function checkProspect(raw: Partial<ProspectInput>): Checked<ProspectInput> {
  const kind = raw.kind === "OPPORTUNITY" ? "OPPORTUNITY" : "PROSPECT";
  const person = checkPerson(raw, kind === "OPPORTUNITY" ? "Opportunity" : "Prospect");
  if (!person.ok) return person;
  const stage = kind === "OPPORTUNITY" ? "OPPORTUNITY" : isBniStage(raw.stage) && raw.stage !== "OPPORTUNITY" ? raw.stage : "PROSPECT";
  const origin: BniOrigin = raw.origin === "BOT" || raw.origin === "121" ? raw.origin : "DIRECT";
  return ok({ ...person.value, kind, origin, stage, remark: str(raw.remark, 500), need: str(raw.need, 300) });
}

export type MemberInput = PersonInput;

export function checkMember(raw: Partial<MemberInput>): Checked<MemberInput> {
  return checkPerson(raw, "Member");
}

export interface Log121Input {
  /** Existing member, or `member` for a new one. */
  memberId?: string;
  member?: MemberInput;
  date: string;
  type: BniMeetingType;
  refsReceived: number;
  refsGiven: number;
  /** Names of the referrals received (one per line); fills the first N of `refsReceived`. */
  referralNames: string[];
  notes: string;
  /** "Save & Convert Refs → Prospects": named referrals become prospects at once. */
  convert: boolean;
}

const count = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(50, Math.floor(n)) : -1;
};

export function checkLog121(raw: Partial<Log121Input>): Checked<Log121Input> {
  let member: MemberInput | undefined;
  const memberId = str(raw.memberId, 100) || undefined;
  if (!memberId) {
    const m = checkMember(raw.member ?? {});
    if (!m.ok) return m;
    member = m.value;
  }
  if (typeof raw.date !== "string" || !DATE_RE.test(raw.date)) return fail("Pick the meeting date.");
  const type = (MEETING_TYPES as readonly string[]).includes(raw.type as string) ? (raw.type as BniMeetingType) : "121 Meeting";
  const names = (Array.isArray(raw.referralNames) ? raw.referralNames : []).map((n) => str(n, 200)).filter(Boolean).slice(0, 50);
  const refsReceived = count(raw.refsReceived);
  const refsGiven = count(raw.refsGiven);
  if (refsReceived < 0 || refsGiven < 0) return fail("Referral counts must be 0 or more (up to 50).");
  return ok({
    memberId,
    member,
    date: raw.date,
    type,
    refsReceived: Math.max(refsReceived, names.length),
    refsGiven,
    referralNames: names,
    notes: str(raw.notes, 10_000),
    convert: raw.convert === true,
  });
}

export interface ReferralInput {
  direction: "RECEIVED" | "GIVEN";
  memberId?: string;
  /** New member (by name) when the referral is logged against someone not yet in Setu. */
  memberName?: string;
  details: ReferralDetails;
  /** Received only: add the referral to the pipeline right away. */
  convert: boolean;
}

export function checkReferral(raw: Partial<ReferralInput>): Checked<ReferralInput> {
  const direction = raw.direction === "GIVEN" ? "GIVEN" : "RECEIVED";
  const memberId = str(raw.memberId, 100) || undefined;
  const memberName = str(raw.memberName, 200);
  if (!memberId && !memberName) return fail("Pick the BNI member.");
  const d = raw.details ?? ({} as Partial<ReferralDetails>);
  const name = str(d.name, 200);
  if (!name) return fail(direction === "RECEIVED" ? "Who was referred to you?" : "Who did you refer?");
  const phone = str(d.phone, 40);
  if (phone && phone.replace(/\D/g, "").length < 10) return fail("Enter a 10-digit phone number (or leave it blank).");
  return ok({
    direction,
    memberId,
    memberName: memberId ? undefined : memberName,
    details: { name, business: str(d.business, 200), phone, via: str(d.via, 200) },
    convert: direction === "RECEIVED" && raw.convert === true,
  });
}

/** Plain text → the HTML the meeting agenda / note fields store. */
export function textToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${esc(l)}</p>`)
    .join("");
}

// ── WhatsApp bot commands ─────────────────────────────────────────────────────

export type BotCommand =
  | { type: "help" }
  | { type: "status" }
  | { type: "note"; member: string; text: string }
  | { type: "ref"; direction: "RECEIVED" | "GIVEN"; count: number; name: string }
  | { type: "move"; name: string; stage: BniStage }
  | { type: "unknown"; reason: string };

const STAGE_ALIASES: [BniStage, string[]][] = [
  ["CLIENT_MEET_1", ["client meet 1", "meet 1", "cm1"]],
  ["CLIENT_MEET_2", ["client meet 2", "meet 2", "cm2"]],
  ["ESTIMATE_SENT", ["estimate sent", "sent"]],
  ["ESTIMATION", ["est./proposal", "est. / proposal", "estimation", "proposal", "estimate"]],
  ["DISCOVERY", ["discovery mtg", "discovery meeting", "discovery"]],
  ["NEGOTIATION", ["negotiation", "negotiate"]],
  ["AGREEMENT", ["agreement"]],
  ["WON", ["deal won", "won", "closed"]],
  ["ON_HOLD", ["on hold", "hold"]],
  ["LOST", ["lost"]],
  ["OPPORTUNITY", ["mixed/opport.", "opportunity", "mixed"]],
  ["PROSPECT", ["prospect"]],
];

/** "won" / "client meet 2" / "proposal" → the stage (longest alias wins). */
export function parseStage(text: string): BniStage | null {
  const t = text.trim().toLowerCase();
  for (const [stage, aliases] of STAGE_ALIASES) if (aliases.includes(t)) return stage;
  return null;
}

/** The text commands from the design: note, status, ref recv / ref gave, move. */
export function parseBotCommand(input: string): BotCommand {
  const text = input.trim().replace(/\s+/g, " ");
  const lower = text.toLowerCase();
  if (!text || lower === "help" || lower === "?") return { type: "help" };
  if (lower === "status") return { type: "status" };

  if (lower.startsWith("note ")) {
    const rest = text.slice(5);
    const sep = rest.search(/[:\-–]/);
    if (sep <= 0) return { type: "unknown", reason: "Use: note [member]: your note" };
    const member = rest.slice(0, sep).trim();
    const body = rest.slice(sep + 1).trim();
    if (!member || !body) return { type: "unknown", reason: "Use: note [member]: your note" };
    return { type: "note", member, text: body };
  }

  const ref = /^ref (recv|received|gave|given) (\d+) (from|to) (.+)$/i.exec(text);
  if (ref) {
    const received = ref[1].toLowerCase().startsWith("rec");
    if (received !== (ref[3].toLowerCase() === "from")) return { type: "unknown", reason: "Use: ref recv [n] from [name] · ref gave [n] to [name]" };
    const n = Number(ref[2]);
    if (n < 1 || n > 50) return { type: "unknown", reason: "Referral count must be 1–50." };
    return { type: "ref", direction: received ? "RECEIVED" : "GIVEN", count: n, name: ref[4].trim() };
  }
  if (lower.startsWith("ref ")) return { type: "unknown", reason: "Use: ref recv [n] from [name] · ref gave [n] to [name]" };

  if (lower.startsWith("move ")) {
    const words = text.slice(5).split(" ");
    // The stage is the trailing 1–3 words; the rest is the name.
    for (let k = Math.min(3, words.length - 1); k >= 1; k--) {
      const stage = parseStage(words.slice(-k).join(" "));
      if (stage) return { type: "move", name: words.slice(0, -k).join(" "), stage };
    }
    return { type: "unknown", reason: "Use: move [name] [stage] — e.g. move Amit Pandey discovery" };
  }
  return { type: "unknown", reason: "Unknown command. Type help to see the commands." };
}

const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/\bji\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Best match by name ("amit" → "Amit Pandey Ji"): exact first, then prefix, then contains. */
export function findByName<T extends Pick<Deal, "contactName" | "company">>(records: T[], name: string): T | undefined {
  const n = normName(name);
  if (!n) return undefined;
  const names = (r: T) => [normName(r.contactName), normName(r.company)];
  return (
    records.find((r) => names(r).includes(n)) ??
    records.find((r) => names(r).some((x) => x.startsWith(n))) ??
    records.find((r) => names(r).some((x) => x.includes(n)))
  );
}

/** "status" reply: counts per non-empty column. */
export function pipelineStatusText(deals: Deal[]): string {
  const counts = new Map<BniStage, number>();
  for (const d of deals) if (isPipelineRecord(d)) counts.set(bniStageOf(d), (counts.get(bniStageOf(d)) ?? 0) + 1);
  const lines = BNI_STAGES.filter((s) => counts.get(s.id)).map((s) => `${s.label}: ${counts.get(s.id)}`);
  return lines.length ? lines.join("\n") : "The pipeline is empty.";
}

// ── vCard import ──────────────────────────────────────────────────────────────

/** Contacts in a .vcf file (vCard 2.1 / 3.0 / 4.0): name, phone, email, organisation, address. */
export function parseVCards(text: string): PersonInput[] {
  // Unfold continuation lines (RFC 6350 §3.2) and quoted-printable soft breaks.
  const lines = text.replace(/=\r?\n/g, "").replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const out: PersonInput[] = [];
  let cur: PersonInput | null = null;
  let structured = "";
  const value = (line: string) => line.slice(line.indexOf(":") + 1).trim().replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/gi, " ");
  for (const raw of lines) {
    const line = raw.trim();
    const key = line.slice(0, Math.max(0, line.indexOf(":"))).split(";")[0].split(".").pop()?.toUpperCase() ?? "";
    if (/^BEGIN:VCARD$/i.test(line)) {
      cur = { name: "", business: "", phone: "", email: "", address: "", via: "" };
      structured = "";
    } else if (/^END:VCARD$/i.test(line)) {
      if (cur) {
        if (!cur.name) cur.name = structured;
        if (cur.name || cur.phone || cur.email) out.push(cur);
      }
      cur = null;
    } else if (cur) {
      const v = value(line);
      if (key === "FN" && v) cur.name = v;
      else if (key === "N" && v) structured = v.split(";").slice(0, 2).reverse().filter(Boolean).join(" ");
      else if (key === "TEL" && v && !cur.phone) cur.phone = v;
      else if (key === "EMAIL" && v && !cur.email) cur.email = v;
      else if (key === "ORG" && v) cur.business = v.split(";").filter(Boolean).join(", ");
      else if (key === "ADR" && v && !cur.address) cur.address = v.split(";").filter(Boolean).join(", ");
    }
  }
  return out;
}
