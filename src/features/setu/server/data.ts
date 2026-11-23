// Server-only module (imports the DB client) — import from Server Components / Server Actions only.
import { db } from "@/lib/db";
import type { Prisma } from "../../../../generated/prisma/client";
import type {
  ActiveTimer,
  Deal,
  DealCall,
  DealFile,
  DealMeeting,
  DealNote,
  DealTimeLog,
  MeetingReminder,
  NegotiationRequest,
  ProposalVersion,
  SetuSnapshot,
  TeamMember,
} from "../types";

// Reads for the Setu CRM: Prisma rows → the view types the Setu pages use (see ../types.ts).
// All internal staff see all Setu data (decided 2026-11-23), so the layout loads one snapshot.

// ── Small converters ──────────────────────────────────────────────────────────

const iso = (d: Date) => d.toISOString();
/** @db.Date columns → "yyyy-mm-dd". */
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
/** "yyyy-mm-dd" → Date at UTC midnight (what Prisma stores in a @db.Date). */
export const dayToDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

const REMINDER_TO_DB = { "15m": "MIN_15", "30m": "MIN_30", "1h": "HOUR_1", "1d": "DAY_1" } as const;
const REMINDER_FROM_DB: Record<string, MeetingReminder> = { MIN_15: "15m", MIN_30: "30m", HOUR_1: "1h", DAY_1: "1d" };
export const reminderToDb = (r: MeetingReminder) => REMINDER_TO_DB[r];

const userName = (u: { name: string | null; email: string }) => u.name?.trim() || u.email;
const userSelect = { id: true, name: true, email: true, title: true } as const;

export function toTeamMember(u: { id: string; name: string | null; email: string; title?: string | null }): TeamMember {
  return { id: u.id, name: userName(u), email: u.email, title: u.title ?? undefined };
}

// ── Includes + mappers ────────────────────────────────────────────────────────

export const dealInclude = {
  owner: { select: userSelect },
  won: true,
  lost: true,
  files: { where: { kind: "CLOSING_DOCUMENT" }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.CrmDealInclude;
type DealRow = Prisma.CrmDealGetPayload<{ include: typeof dealInclude }>;

function toFile(f: { id: string; name: string; size: number; url: string }): DealFile {
  return { id: f.id, name: f.name, size: f.size, url: f.url };
}

export function toDeal(d: DealRow): Deal {
  return {
    id: d.id,
    leadCode: d.leadCode,
    dealCode: d.dealCode ?? undefined,
    title: d.title,
    company: d.company,
    contactName: d.contactName,
    contactRole: d.contactRole,
    phone: d.phone,
    email: d.email,
    location: d.location,
    source: d.source,
    stage: d.stage,
    ownerId: d.ownerId,
    ownerName: userName(d.owner),
    value: d.value ?? undefined,
    proposalVersion: d.proposalVersion ?? undefined,
    remark: d.remark,
    dueDate: d.dueDate ? isoDay(d.dueDate) : undefined,
    closedAt: d.closedAt ? isoDay(d.closedAt) : undefined,
    won: d.won
      ? {
          finalValue: d.won.finalValue,
          closedDate: isoDay(d.won.closedDate),
          advanceReceived: d.won.advanceReceived,
          contractTerm: d.won.contractTerm,
          paymentTerms: d.won.paymentTerms,
          documents: d.files.map(toFile),
        }
      : undefined,
    lost: d.lost
      ? {
          lostValue: d.lost.lostValue,
          primaryReason: d.lost.primaryReason,
          secondaryFactor: d.lost.secondaryFactor,
          closedDate: isoDay(d.lost.closedDate),
          analysis: d.lost.analysis,
          reengageDate: d.lost.reengageDate ? isoDay(d.lost.reengageDate) : undefined,
          reengageNote: d.lost.reengageNote,
          keepNurturing: d.lost.keepNurturing,
        }
      : undefined,
    updatedAt: iso(d.updatedAt),
  };
}

export const noteInclude = { author: { select: userSelect } } satisfies Prisma.CrmNoteInclude;
type NoteRow = Prisma.CrmNoteGetPayload<{ include: typeof noteInclude }>;

export function toNote(n: NoteRow): DealNote {
  return {
    id: n.id,
    dealId: n.dealId,
    category: n.category,
    title: n.title,
    body: n.body,
    pinned: n.pinned,
    authorId: n.authorId,
    authorName: userName(n.author),
    createdAt: iso(n.createdAt),
  };
}

export const timeLogInclude = { user: { select: userSelect } } satisfies Prisma.CrmTimeLogInclude;
type TimeLogRow = Prisma.CrmTimeLogGetPayload<{ include: typeof timeLogInclude }>;

export function toTimeLog(l: TimeLogRow): DealTimeLog {
  return { id: l.id, dealId: l.dealId, userId: l.userId, employeeName: userName(l.user), reason: l.reason, startedAt: iso(l.startedAt), endedAt: iso(l.endedAt) };
}

export function toRequest(r: { id: string; dealId: string; level: number; text: string; requestedBy: string }): NegotiationRequest {
  return { id: r.id, dealId: r.dealId, level: r.level, text: r.text, requestedBy: r.requestedBy };
}

export const callInclude = { rep: { select: userSelect } } satisfies Prisma.CrmCallInclude;
type CallRow = Prisma.CrmCallGetPayload<{ include: typeof callInclude }>;

export function toCall(c: CallRow): DealCall {
  return {
    id: c.id,
    dealId: c.dealId,
    title: c.title,
    direction: c.direction,
    outcome: c.outcome,
    startedAt: iso(c.startedAt),
    endedAt: iso(c.endedAt),
    repId: c.repId,
    repName: userName(c.rep),
    repRole: c.repRole ?? undefined,
    contactName: c.contactName,
    contactRole: c.contactRole ?? undefined,
    summary: c.summary,
    recordingUrl: c.recordingUrl ?? undefined,
  };
}

export const meetingInclude = {
  host: { select: userSelect },
  attendees: { orderBy: { id: "asc" } },
  events: { orderBy: { at: "asc" } },
} satisfies Prisma.CrmMeetingInclude;
type MeetingRow = Prisma.CrmMeetingGetPayload<{ include: typeof meetingInclude }>;

export function toMeeting(m: MeetingRow): DealMeeting {
  return {
    id: m.id,
    dealId: m.dealId,
    title: m.title,
    type: m.type,
    startAt: iso(m.startAt),
    endAt: iso(m.endAt),
    hostId: m.hostId,
    hostName: userName(m.host),
    hostRole: m.hostRole ?? undefined,
    channel: m.channel,
    link: m.link ?? undefined,
    location: m.location ?? undefined,
    agenda: m.agenda,
    status: m.status,
    reminder: REMINDER_FROM_DB[m.reminder] ?? "30m",
    summary: m.summary ?? undefined,
    recordingUrl: m.recordingUrl ?? undefined,
    attendees: m.attendees.map((a) => ({
      id: a.id,
      userId: a.userId ?? undefined,
      name: a.name,
      role: a.role ?? undefined,
      email: a.email ?? undefined,
      company: a.company ?? undefined,
      external: a.external,
      source: a.source,
      rsvp: a.rsvp,
      attended: a.attended ?? undefined,
    })),
    history: m.events.map((e) => ({ id: e.id, at: iso(e.at), title: e.title, detail: e.detail, tone: e.tone.toLowerCase() as "blue" | "green" | "amber" | "red" })),
  };
}

export const proposalInclude = {
  author: { select: userSelect },
  files: { orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.CrmProposalInclude;
type ProposalRow = Prisma.CrmProposalGetPayload<{ include: typeof proposalInclude }>;

export function toProposal(p: ProposalRow): ProposalVersion {
  return {
    id: p.id,
    dealId: p.dealId,
    version: p.version,
    title: p.title,
    value: p.value,
    reason: p.reason,
    authorId: p.authorId,
    authorName: userName(p.author),
    authorRole: p.authorRole ?? undefined,
    createdAt: iso(p.updatedAt),
    status: p.status,
    sentVia: p.sentVia ?? undefined,
    attachment: p.files[0] ? toFile(p.files[0]) : undefined,
  };
}

// ── Loaders ───────────────────────────────────────────────────────────────────

/** WinOS users who can take part in Setu (active, not client logins). */
export async function loadTeam(): Promise<TeamMember[]> {
  const users = await db.user.findMany({
    where: { isActive: true, NOT: { profileRole: "CLIENT" } },
    select: userSelect,
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  return users.map(toTeamMember);
}

/** Everything the Setu pages show, for one signed-in user. */
export async function getSetuSnapshot(me: TeamMember): Promise<SetuSnapshot> {
  const [team, deals, notes, timeLogs, timer, requests, calls, meetings, proposals] = await Promise.all([
    loadTeam(),
    db.crmDeal.findMany({ include: dealInclude, orderBy: { updatedAt: "desc" } }),
    db.crmNote.findMany({ include: noteInclude, orderBy: { createdAt: "desc" } }),
    db.crmTimeLog.findMany({ include: timeLogInclude, orderBy: { startedAt: "desc" } }),
    db.crmActiveTimer.findUnique({ where: { userId: me.id } }),
    db.crmNegotiationRequest.findMany({ orderBy: [{ dealId: "asc" }, { level: "asc" }] }),
    db.crmCall.findMany({ include: callInclude, orderBy: { startedAt: "desc" } }),
    db.crmMeeting.findMany({ include: meetingInclude, orderBy: { startAt: "desc" } }),
    db.crmProposal.findMany({ include: proposalInclude, orderBy: [{ dealId: "asc" }, { version: "desc" }] }),
  ]);
  const activeTimer: ActiveTimer | null = timer ? { dealId: timer.dealId, userId: timer.userId, employeeName: me.name, startedAt: iso(timer.startedAt) } : null;
  return {
    me,
    team,
    deals: deals.map(toDeal),
    notes: notes.map(toNote),
    timeLogs: timeLogs.map(toTimeLog),
    activeTimer,
    requests: requests.map(toRequest),
    calls: calls.map(toCall),
    meetings: meetings.map(toMeeting),
    proposals: proposals.map(toProposal),
  };
}

export async function loadDeal(id: string): Promise<Deal | null> {
  const d = await db.crmDeal.findUnique({ where: { id }, include: dealInclude });
  return d ? toDeal(d) : null;
}

export async function loadMeeting(id: string): Promise<DealMeeting | null> {
  const m = await db.crmMeeting.findUnique({ where: { id }, include: meetingInclude });
  return m ? toMeeting(m) : null;
}

export async function loadDealProposals(dealId: string): Promise<ProposalVersion[]> {
  const rows = await db.crmProposal.findMany({ where: { dealId }, include: proposalInclude, orderBy: { version: "desc" } });
  return rows.map(toProposal);
}

export async function loadDealRequests(dealId: string): Promise<NegotiationRequest[]> {
  const rows = await db.crmNegotiationRequest.findMany({ where: { dealId }, orderBy: { level: "asc" } });
  return rows.map(toRequest);
}
