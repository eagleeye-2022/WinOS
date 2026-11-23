import { DEAL_STAGES, STAGE_BY_ID } from "./constants";
import type { Deal, DealCall, DealMeeting, DealNote, DealStage, DealTimeLog, ProposalVersion } from "./types";
import { isDealStage, isoDate, logSeconds } from "./utils";

// Read-side calculations for the Setu Dashboard, Leads, Deals, Contacts and Calls pages.
// Pure — unit-tested in src/__tests__/unit/setu-insights.test.ts.

/** Lead stages (before Proposal): Lead, Meeting, Discussions. */
export const LEAD_STAGES: readonly DealStage[] = DEAL_STAGES.filter((s) => !isDealStage(s.id)).map((s) => s.id);
/** Deal stages (from Proposal on): Proposal, Negotiation, Closed Won, Closed Lost. */
export const DEALS_STAGES: readonly DealStage[] = DEAL_STAGES.filter((s) => isDealStage(s.id)).map((s) => s.id);

export const isLead = (d: Pick<Deal, "stage">) => !isDealStage(d.stage);
export const isOpen = (d: Pick<Deal, "stage">) => !STAGE_BY_ID[d.stage].closed;

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// ── Generic list helpers ──────────────────────────────────────────────────────

export function matchesText(needle: string, ...fields: (string | undefined | null)[]): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return true;
  return fields.filter(Boolean).join(" ").toLowerCase().includes(n);
}

export type Period = "all" | "today" | "week" | "month" | "quarter";

/** Whether an ISO date / datetime falls in the period ending today (IST). Quarter = Indian FY quarter. */
export function inPeriod(iso: string | undefined, period: Period, today: string): boolean {
  if (period === "all") return true;
  if (!iso) return false;
  const day = iso.length === 10 ? iso : isoDate(iso);
  if (period === "today") return day === today;
  if (period === "week") return day >= addDays(today, -6) && day <= today;
  if (period === "month") return day.slice(0, 7) === today.slice(0, 7);
  const q = (iso8601: string) => {
    const y = Number(iso8601.slice(0, 4));
    const m = Number(iso8601.slice(5, 7));
    const fy = m >= 4 ? y : y - 1;
    return `${fy}-${Math.floor(((m + 8) % 12) / 3)}`;
  };
  return q(day) === q(today);
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: (string | number | undefined | null)[][]): string {
  return rows.map((r) => r.map((c) => csvCell(c === undefined || c === null ? "" : String(c))).join(",")).join("\n");
}

/** Triggers a browser download of `csv`. */
export function downloadCsv(fileName: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Deals & pipeline ──────────────────────────────────────────────────────────

export interface PipelineStats {
  /** Value of every open record (leads with a value + open deals). */
  openValue: number;
  openCount: number;
  leadCount: number;
  wonValue: number;
  wonCount: number;
  lostCount: number;
  /** Won ÷ (won + lost), 0–100; null when nothing has closed yet. */
  winRate: number | null;
  /** Average closed-won value; null when nothing won. */
  avgWon: number | null;
}

export function pipelineStats(deals: Deal[]): PipelineStats {
  const open = deals.filter(isOpen);
  const won = deals.filter((d) => d.stage === "CLOSED_WON");
  const lost = deals.filter((d) => d.stage === "CLOSED_LOST");
  const wonValue = won.reduce((n, d) => n + (d.value ?? 0), 0);
  const closed = won.length + lost.length;
  return {
    openValue: open.reduce((n, d) => n + (d.value ?? 0), 0),
    openCount: open.length,
    leadCount: deals.filter(isLead).length,
    wonValue,
    wonCount: won.length,
    lostCount: lost.length,
    winRate: closed ? Math.round((won.length / closed) * 100) : null,
    avgWon: won.length ? Math.round(wonValue / won.length) : null,
  };
}

/** Count + value per board stage, in board order. */
export function stageBreakdown(deals: Deal[]): { stage: DealStage; count: number; value: number }[] {
  return DEAL_STAGES.map((s) => {
    const inStage = deals.filter((d) => d.stage === s.id);
    return { stage: s.id, count: inStage.length, value: inStage.reduce((n, d) => n + (d.value ?? 0), 0) };
  });
}

export interface OwnerRow {
  ownerId: string;
  ownerName: string;
  open: number;
  openValue: number;
  won: number;
  wonValue: number;
}

/** Per-rep totals, best closed-won value first. */
export function ownerLeaderboard(deals: Deal[]): OwnerRow[] {
  const map = new Map<string, OwnerRow>();
  for (const d of deals) {
    const row = map.get(d.ownerId) ?? { ownerId: d.ownerId, ownerName: d.ownerName, open: 0, openValue: 0, won: 0, wonValue: 0 };
    if (isOpen(d)) {
      row.open += 1;
      row.openValue += d.value ?? 0;
    }
    if (d.stage === "CLOSED_WON") {
      row.won += 1;
      row.wonValue += d.value ?? 0;
    }
    map.set(d.ownerId, row);
  }
  return [...map.values()].sort((a, b) => b.wonValue - a.wonValue || b.openValue - a.openValue || a.ownerName.localeCompare(b.ownerName));
}

/** Open records with a due date up to `days` ahead — overdue first, then soonest. */
export function followUps(deals: Deal[], today: string, days = 7): { deal: Deal; overdue: boolean }[] {
  const until = addDays(today, days);
  return deals
    .filter((d) => isOpen(d) && d.dueDate && d.dueDate <= until)
    .sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string))
    .map((deal) => ({ deal, overdue: (deal.dueDate as string) < today }));
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export type Relationship = "CUSTOMER" | "ACTIVE_DEAL" | "LEAD" | "LOST";

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  CUSTOMER: "Customer",
  ACTIVE_DEAL: "Active Deal",
  LEAD: "Lead",
  LOST: "Lost",
};

export interface CrmContact {
  key: string;
  name: string;
  role?: string;
  company: string;
  email?: string;
  phone?: string;
  /** Deals this person is the decision maker on or attended a meeting for. */
  dealIds: string[];
  /** The most relevant deal to open (customer / active first). */
  primaryDealId: string;
  ownerNames: string[];
  relationship: Relationship;
  /** ISO datetime of the latest touch (deal update or meeting). */
  lastTouch: string;
}

function relationshipOf(stages: DealStage[]): Relationship {
  if (stages.includes("CLOSED_WON")) return "CUSTOMER";
  if (stages.some((s) => s === "PROPOSAL" || s === "NEGOTIATION")) return "ACTIVE_DEAL";
  if (stages.some((s) => !isDealStage(s))) return "LEAD";
  return "LOST";
}

const RELATIONSHIP_RANK: Record<Relationship, number> = { CUSTOMER: 0, ACTIVE_DEAL: 1, LEAD: 2, LOST: 3 };

/**
 * Everyone on the client side: each deal's decision maker plus external meeting attendees,
 * merged by email (or name + company when there is no email).
 */
export function buildContacts(deals: Deal[], meetings: DealMeeting[]): CrmContact[] {
  const dealById = new Map(deals.map((d) => [d.id, d]));
  const byKey = new Map<string, CrmContact & { stages: DealStage[] }>();
  const keyOf = (name: string, company: string, email?: string) => (email ? email.trim().toLowerCase() : `${name.trim().toLowerCase()}|${company.trim().toLowerCase()}`);

  const touch = (c: { name: string; role?: string; company: string; email?: string; phone?: string }, deal: Deal, at: string) => {
    const key = keyOf(c.name, c.company, c.email);
    const row = byKey.get(key) ?? {
      key,
      name: c.name,
      role: c.role,
      company: c.company,
      email: c.email,
      phone: c.phone,
      dealIds: [],
      primaryDealId: deal.id,
      ownerNames: [],
      relationship: "LEAD" as Relationship,
      lastTouch: at,
      stages: [],
    };
    row.role ||= c.role;
    row.phone ||= c.phone;
    row.email ||= c.email;
    if (!row.dealIds.includes(deal.id)) {
      row.dealIds.push(deal.id);
      row.stages.push(deal.stage);
    }
    if (!row.ownerNames.includes(deal.ownerName)) row.ownerNames.push(deal.ownerName);
    if (at > row.lastTouch) row.lastTouch = at;
    byKey.set(key, row);
  };

  for (const d of deals) {
    if (d.contactName) touch({ name: d.contactName, role: d.contactRole || undefined, company: d.company, email: d.email || undefined, phone: d.phone || undefined }, d, d.updatedAt);
  }
  for (const m of meetings) {
    const deal = dealById.get(m.dealId);
    if (!deal || m.status === "DRAFT") continue;
    for (const a of m.attendees) {
      if (a.external) touch({ name: a.name, role: a.role, company: a.company || deal.company, email: a.email }, deal, m.startAt);
    }
  }

  return [...byKey.values()]
    .map(({ stages, ...c }) => {
      const relationship = relationshipOf(stages);
      const primary = [...c.dealIds].sort((a, b) => {
        const ra = RELATIONSHIP_RANK[relationshipOf([dealById.get(a)!.stage])];
        const rb = RELATIONSHIP_RANK[relationshipOf([dealById.get(b)!.stage])];
        return ra - rb || dealById.get(b)!.updatedAt.localeCompare(dealById.get(a)!.updatedAt);
      })[0];
      return { ...c, relationship, primaryDealId: primary };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── Activity feed ─────────────────────────────────────────────────────────────

export type ActivityKind = "note" | "call" | "meeting" | "proposal" | "time";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  at: string;
  dealId: string;
  title: string;
  detail: string;
}

/** Latest things that happened across all deals, newest first. */
export function recentActivity(
  src: { notes: DealNote[]; calls: DealCall[]; meetings: DealMeeting[]; proposals: ProposalVersion[]; timeLogs: DealTimeLog[] },
  limit = 10
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...src.notes.map((n) => ({
      id: `n-${n.id}`,
      kind: "note" as const,
      at: n.createdAt,
      dealId: n.dealId,
      title: n.title,
      detail: `${n.category === "NOTE" ? "Note" : n.category === "DISCUSSION" ? "Discussion" : "Negotiation update"} by ${n.authorName}`,
    })),
    ...src.calls.map((c) => ({ id: `c-${c.id}`, kind: "call" as const, at: c.startedAt, dealId: c.dealId, title: c.title, detail: `Call by ${c.repName} with ${c.contactName}` })),
    ...src.meetings.flatMap((m) =>
      m.history.map((h) => ({ id: `m-${h.id}`, kind: "meeting" as const, at: h.at, dealId: m.dealId, title: `${h.title}: ${m.title}`, detail: h.detail }))
    ),
    ...src.proposals
      .filter((p) => p.status !== "DRAFT")
      .map((p) => ({ id: `p-${p.id}`, kind: "proposal" as const, at: p.createdAt, dealId: p.dealId, title: `Proposal V${p.version}: ${p.title}`, detail: `By ${p.authorName}` })),
    ...src.timeLogs.map((l) => ({
      id: `t-${l.id}`,
      kind: "time" as const,
      at: l.endedAt,
      dealId: l.dealId,
      title: l.reason,
      detail: `${l.employeeName} logged ${Math.round(logSeconds(l) / 60)} min`,
    })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
