import type { Meeting121, Prospect, SetuContact, SetuStats } from "./types";

/** Share (0–100) of prospects that are still moving — everything except Lost and On Hold. */
export function pipelineHealth(prospects: Prospect[]): number {
  if (prospects.length === 0) return 0;
  const alive = prospects.filter((p) => p.stage !== "LOST" && p.stage !== "ON_HOLD").length;
  return Math.round((alive / prospects.length) * 100);
}

export function computeStats(meetings: Meeting121[], prospects: Prospect[]): SetuStats {
  return {
    pipelineHealth: pipelineHealth(prospects),
    prospects: prospects.length,
    meetings: meetings.length,
    refsReceived: meetings.reduce((n, m) => n + m.refsReceived, 0),
    refsGiven: meetings.reduce((n, m) => n + m.refsGiven, 0),
    won: prospects.filter((p) => p.stage === "WON").length,
  };
}

/**
 * Contacts are derived: every 121 member plus every prospect. A member who is also a prospect
 * (Amit Pandey Ji) shows once, as the prospect, carrying the member's referral count.
 */
export function buildContacts(meetings: Meeting121[], prospects: Prospect[]): SetuContact[] {
  const byName = new Map<string, SetuContact>();
  for (const m of meetings) {
    byName.set(normName(m.memberName), {
      id: m.id,
      kind: "MEMBER",
      name: m.memberName,
      business: m.business,
      phone: m.phone,
      connectedVia: m.connectedVia,
      refsReceived: m.refsReceived,
      href: `/setu/meetings?open=${m.id}`,
    });
  }
  for (const p of prospects) {
    const existing = byName.get(normName(p.name));
    byName.set(normName(p.name), {
      id: p.id,
      kind: "PROSPECT",
      name: p.name,
      business: p.business,
      phone: p.phone || existing?.phone || "",
      connectedVia: p.connectedVia,
      stage: p.stage,
      source: p.source,
      refsReceived: existing?.refsReceived,
      href: `/setu/pipeline?open=${p.id}`,
    });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function normName(name: string): string {
  return name.toLowerCase().replace(/\s+ji\b/g, "").replace(/\s+/g, " ").trim();
}

export function initials(name: string): string {
  return name
    .replace(/\bJi\b/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-pink-600",
  "bg-orange-600",
  "bg-cyan-600",
  "bg-amber-600",
  "bg-indigo-600",
];

/** Stable avatar colour per name. */
export function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** "2026-10-24" → "24 Oct 2026" (or "24 Oct" with `short`). */
export function formatDate(iso: string, short = false): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", short ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

/** ₹1,20,000 → "₹1.2L"; below a lakh → "₹45k". */
export function formatInrShort(value: number): string {
  if (value >= 100000) return `₹${+(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${Math.round(value / 1000)}k`;
  return `₹${value}`;
}
