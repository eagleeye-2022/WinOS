import { STAGE_BY_ID, STAGE_IDS, isOnlineChannel } from "./constants";
import type { Deal, DealCall, DealMeeting, DealNote, DealStage, DealTimeLog, ProposalVersion } from "./types";

// Pure helpers for the Setu CRM (unit-tested in src/__tests__/unit/setu-utils.test.ts).

/** A lead is shown with its LD code until it reaches Proposal; from then on with its DEAL code. */
export function displayCode(deal: Pick<Deal, "stage" | "leadCode" | "dealCode">): string {
  return isDealStage(deal.stage) && deal.dealCode ? deal.dealCode : deal.leadCode;
}

/** Proposal and every stage after it (including Closed Lost) is a deal rather than a lead. */
export function isDealStage(stage: DealStage): boolean {
  return STAGE_IDS.indexOf(stage) >= STAGE_IDS.indexOf("PROPOSAL");
}

/** Card / header title: a fresh lead is shown by its contact; a deal by its title. */
export function dealTitle(deal: Pick<Deal, "stage" | "title" | "contactName" | "company">): string {
  if (deal.stage === "LEAD") return deal.contactName || deal.company;
  return deal.title || deal.company;
}

/** Next number in a "PREFIX-YYYY-NNNN" series. */
export function nextCode(prefix: "LD" | "DEAL", existing: (string | undefined)[], year = new Date().getFullYear()): string {
  const head = `${prefix}-${year}-`;
  const max = existing.reduce((n, code) => {
    if (!code?.startsWith(head)) return n;
    const num = Number.parseInt(code.slice(head.length), 10);
    return Number.isFinite(num) && num > n ? num : n;
  }, 0);
  return `${head}${String(max + 1).padStart(4, "0")}`;
}

// ── Board filters ─────────────────────────────────────────────────────────────

export type DueFilter = "any" | "overdue" | "today" | "week" | "month";
export type RelatedFilter = "all" | "lead" | "deal";

export interface BoardFilters {
  q: string;
  owner: string;
  due: DueFilter;
  related: RelatedFilter;
}

// All dates are shown in IST (the team's timezone) so server and client render the same text.
const IST = "Asia/Kolkata";
const IST_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: IST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** Calendar parts of an ISO datetime in IST; a bare "yyyy-mm-dd" is taken as that date. */
function istParts(iso: string): DateParts | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split("-").map(Number);
    return { year, month, day, hour: 0, minute: 0 };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = IST_PARTS.formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** IST calendar date (yyyy-mm-dd) of a Date / ISO datetime. */
export function isoDate(d: Date | string): string {
  const p = istParts(typeof d === "string" ? d : d.toISOString());
  return p ? `${p.year}-${pad2(p.month)}-${pad2(p.day)}` : "";
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function matchesDue(dueDate: string | undefined, due: DueFilter, today: string): boolean {
  if (due === "any") return true;
  if (!dueDate) return false;
  if (due === "overdue") return dueDate < today;
  if (due === "today") return dueDate === today;
  if (due === "week") return dueDate >= today && dueDate <= addDays(today, 6);
  return dueDate.slice(0, 7) === today.slice(0, 7);
}

/**
 * Board filters. `nextMeetings` (from nextMeetingByDeal) lets a scheduled meeting count as the
 * due date and its title be searched.
 */
export function filterDeals(deals: Deal[], f: BoardFilters, today: string, nextMeetings: Map<string, DealMeeting> = new Map()): Deal[] {
  const needle = f.q.trim().toLowerCase();
  return deals.filter((d) => {
    const meeting = nextMeetings.get(d.id);
    if (f.owner && d.ownerName !== f.owner) return false;
    if (f.related === "lead" && isDealStage(d.stage)) return false;
    if (f.related === "deal" && !isDealStage(d.stage)) return false;
    if (!matchesDue(d.dueDate ?? (meeting ? isoDate(meeting.startAt) : undefined), f.due, today)) return false;
    if (!needle) return true;
    const hay = [d.title, d.company, d.contactName, d.phone, d.email, d.leadCode, d.dealCode, d.remark, meeting?.title]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
}

export function countByStage(deals: Deal[]): Record<DealStage, number> {
  const counts = Object.fromEntries(STAGE_IDS.map((s) => [s, 0])) as Record<DealStage, number>;
  for (const d of deals) counts[d.stage] += 1;
  return counts;
}

/** Header summary: stages that hold open deals, open pipeline value and open (not closed) records. */
export function boardSummary(deals: Deal[]) {
  const open = deals.filter((d) => !STAGE_BY_ID[d.stage].closed);
  return {
    stagesInMotion: new Set(open.map((d) => d.stage)).size,
    pipelineValue: open.reduce((n, d) => n + (d.value ?? 0), 0),
    activeTasks: open.length,
  };
}

// ── Meetings ──────────────────────────────────────────────────────────────────

/** Each deal's soonest upcoming meeting (what its Meeting-column card shows). */
export function nextMeetingByDeal(meetings: DealMeeting[]): Map<string, DealMeeting> {
  const map = new Map<string, DealMeeting>();
  for (const m of meetings) {
    if (m.status !== "UPCOMING") continue;
    const cur = map.get(m.dealId);
    if (!cur || m.startAt < cur.startAt) map.set(m.dealId, m);
  }
  return map;
}

/** Meeting number within its deal, in date order ("Meeting #3"). */
export function meetingNumbers(meetings: DealMeeting[]): Map<string, number> {
  const sorted = [...meetings].sort((a, b) => a.startAt.localeCompare(b.startAt));
  return new Map(sorted.map((m, i) => [m.id, i + 1]));
}

export function meetingStats(meetings: DealMeeting[]) {
  return {
    total: meetings.length,
    upcoming: meetings.filter((m) => m.status === "UPCOMING").length,
    completed: meetings.filter((m) => m.status === "COMPLETED").length,
    external: meetings.filter((m) => m.attendees.some((a) => a.external)).length,
    virtual: meetings.filter((m) => isOnlineChannel(m.channel)).length,
  };
}

const stripTags = (html?: string) => html?.replace(/<[^>]*>/g, " ");

export function searchMeetings(meetings: DealMeeting[], q: string, extra?: (m: DealMeeting) => string): DealMeeting[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return meetings;
  return meetings.filter((m) =>
    [m.title, m.type, stripTags(m.agenda), stripTags(m.summary), m.hostName, m.location, extra?.(m), ...m.attendees.map((a) => a.name)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(needle)
  );
}

/** "in 15 minutes" / "in 2 hours" / "in 3 days" / "in progress" / "ended 2 hours ago". */
export function relativeToNow(startAt: string, endAt: string, nowMs: number): string {
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  const span = (ms: number) => {
    const min = Math.round(ms / 60000);
    if (min < 60) return `${Math.max(1, min)} minute${min === 1 ? "" : "s"}`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h} hour${h === 1 ? "" : "s"}`;
    const d = Math.round(h / 24);
    return `${d} day${d === 1 ? "" : "s"}`;
  };
  if (nowMs < start) return `in ${span(start - nowMs)}`;
  if (nowMs < end) return "in progress";
  return `ended ${span(nowMs - end)} ago`;
}

export type MeetingRange = "week" | "today" | "next7" | "month" | "all";

/** Monday–Sunday (IST) of the week containing `today`. */
export function weekRange(today: string): { start: string; end: string } {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const start = addDays(today, -((dow + 6) % 7));
  return { start, end: addDays(start, 6) };
}

/** "28 Sep – 04 Oct". */
export function formatRange(start: string, end: string): string {
  const s = formatDate(start).slice(0, 6);
  const e = formatDate(end).slice(0, 6);
  return `${s} – ${e}`;
}

export function inMeetingRange(startAt: string, range: MeetingRange, today: string): boolean {
  const day = isoDate(startAt);
  if (range === "all") return true;
  if (range === "today") return day === today;
  if (range === "next7") return day >= today && day <= addDays(today, 6);
  if (range === "month") return day.slice(0, 7) === today.slice(0, 7);
  const { start, end } = weekRange(today);
  return day >= start && day <= end;
}

/**
 * Scheduled meetings that overlap `candidate` and share one of its team members (host or internal
 * attendee) — the "availability" check on the schedule page.
 */
export function findConflicts(
  meetings: DealMeeting[],
  candidate: Pick<DealMeeting, "startAt" | "endAt" | "hostName" | "attendees"> & { id?: string }
): { meeting: DealMeeting; people: string[] }[] {
  const team = new Set([candidate.hostName, ...candidate.attendees.filter((a) => !a.external).map((a) => a.name)].map((n) => n.toLowerCase()));
  const out: { meeting: DealMeeting; people: string[] }[] = [];
  for (const m of meetings) {
    if (m.id === candidate.id || m.status !== "UPCOMING") continue;
    if (!(candidate.startAt < m.endAt && candidate.endAt > m.startAt)) continue;
    const theirs = [m.hostName, ...m.attendees.filter((a) => !a.external).map((a) => a.name)];
    const people = theirs.filter((n) => team.has(n.toLowerCase()));
    if (people.length) out.push({ meeting: m, people: [...new Set(people)] });
  }
  return out;
}

export function meetingsCsv(rows: { meeting: DealMeeting; related: string }[]): string {
  const out = [["Title", "Related Deal / Lead", "Date", "Start", "End", "Type", "Status", "Host", "Attendees"]];
  for (const { meeting: m, related } of rows) {
    out.push([
      m.title,
      related,
      formatDate(m.startAt),
      formatTime(m.startAt),
      formatTime(m.endAt),
      isOnlineChannel(m.channel) ? "Online" : m.channel === "IN_OFFICE" ? "In-office" : "Client Location",
      m.status,
      m.hostName,
      m.attendees.map((a) => a.name).join("; "),
    ]);
  }
  return out.map((r) => r.map(csvCell).join(",")).join("\n");
}

// ── Calls ─────────────────────────────────────────────────────────────────────

export function callStats(calls: DealCall[]) {
  const connected = calls.filter((c) => c.outcome !== "NO_ANSWER").length;
  return {
    total: calls.length,
    talkSeconds: calls.reduce((n, c) => n + logSeconds({ startedAt: c.startedAt, endedAt: c.endedAt }), 0),
    connectRate: calls.length ? Math.round((connected / calls.length) * 100) : 0,
    outbound: calls.filter((c) => c.direction === "OUTBOUND").length,
    inbound: calls.filter((c) => c.direction === "INBOUND").length,
    withAudio: calls.filter((c) => Boolean(c.recordingUrl)).length,
  };
}

export function searchCalls(calls: DealCall[], q: string): DealCall[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return calls;
  return calls.filter((c) => [c.title, c.summary, c.repName, c.contactName].join(" ").toLowerCase().includes(needle));
}

// ── Proposals ─────────────────────────────────────────────────────────────────

/** Percent change from `from` to `to`, one decimal (-13.5). */
export function percentChange(from: number, to: number): number {
  if (!from) return 0;
  return Math.round(((to - from) / from) * 1000) / 10;
}

/** "-13.5%" / "+4%". */
export function formatPercent(p: number): string {
  return `${p > 0 ? "+" : ""}${p}%`;
}

/** Active offer, V1 baseline, discount variance, published revision count and the open draft. */
export function proposalSummary(versions: ProposalVersion[]) {
  const published = versions.filter((v) => v.status !== "DRAFT").sort((a, b) => a.version - b.version);
  const active = published.find((v) => v.status === "ACTIVE") ?? published[published.length - 1];
  const baseline = published[0];
  return {
    active,
    baseline,
    variance: active && baseline ? percentChange(baseline.value, active.value) : 0,
    revisions: published.length,
    draft: versions.find((v) => v.status === "DRAFT"),
    nextVersion: versions.reduce((n, v) => Math.max(n, v.version), 0) + 1,
  };
}

// ── Closure ───────────────────────────────────────────────────────────────────

/** Indian financial year quarter (FY runs Apr–Mar): 14 Jun 2026 → "Q1 FY27". */
export function fiscalQuarter(iso: string): string {
  const p = istParts(iso);
  if (!p) return "";
  const fyEnd = p.month >= 4 ? p.year + 1 : p.year;
  const q = Math.floor(((p.month + 8) % 12) / 3) + 1;
  return `Q${q} FY${String(fyEnd).slice(2)}`;
}

/** Whole percent of `part` in `whole` (0 when whole is 0). */
export function percentOf(part: number, whole: number): number {
  return whole ? Math.round((part / whole) * 100) : 0;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${+(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Digits from a ₹ input ("4,50,000" → 450000); NaN when empty or not a number. */
export function parseInr(input: string): number {
  const clean = input.replace(/[₹,\s]/g, "");
  return clean ? Number(clean) : Number.NaN;
}

// ── Notes ─────────────────────────────────────────────────────────────────────

/** Pinned first, then newest first. */
export function sortNotes(notes: DealNote[]): DealNote[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
}

// ── Time logs ─────────────────────────────────────────────────────────────────

export function logSeconds(log: Pick<DealTimeLog, "startedAt" | "endedAt">): number {
  return Math.max(0, Math.round((Date.parse(log.endedAt) - Date.parse(log.startedAt)) / 1000));
}

export function timeLogStats(logs: DealTimeLog[], today: string) {
  return {
    totalSeconds: logs.reduce((n, l) => n + logSeconds(l), 0),
    todaySeconds: logs.filter((l) => isoDate(l.startedAt) === today).reduce((n, l) => n + logSeconds(l), 0),
    sessions: logs.length,
    employees: new Set(logs.map((l) => l.employeeName)).size,
  };
}

/** 6h 42m · 24m · 0m — for totals. */
export function formatHoursMinutes(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Table duration: "24m 36s" under an hour, "1h 15m" from an hour. */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** Running clock "00:24:37". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function timeLogsCsv(logs: DealTimeLog[]): string {
  const rows = [["Date", "Employee", "Reason", "Start Time", "End Time", "Duration"]];
  for (const l of logs) {
    rows.push([formatDate(l.startedAt), l.employeeName, l.reason, formatTime(l.startedAt), formatTime(l.endedAt), formatDuration(logSeconds(l))]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

// ── Formatting ────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "04 Oct 2026". */
export function formatDate(iso: string): string {
  const p = istParts(iso);
  return p ? `${pad2(p.day)} ${MONTHS[p.month - 1]} ${p.year}` : iso;
}

/** "25/05/2026". */
export function formatSlashDate(iso: string): string {
  const p = istParts(iso);
  return p ? `${pad2(p.day)}/${pad2(p.month)}/${p.year}` : iso;
}

/** "04:22 PM" from an ISO datetime (IST), or from "HH:mm". */
export function formatTime(isoOrHhmm: string): string {
  let h: number;
  let m: number;
  if (/^\d{2}:\d{2}$/.test(isoOrHhmm)) {
    [h, m] = isoOrHhmm.split(":").map(Number);
  } else {
    const p = istParts(isoOrHhmm);
    if (!p) return isoOrHhmm;
    h = p.hour;
    m = p.minute;
  }
  return `${pad2(h % 12 || 12)}:${pad2(m)} ${h >= 12 ? "PM" : "AM"}`;
}

/** "11:00 AM – 12:00 PM". */
export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`;
}

/** Meeting length: "1h", "1h 15m", "45m". */
export function formatSpan(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** "Today" / "Tomorrow" / "Yesterday" for an ISO datetime relative to `today` (IST), else null. */
export function relativeDay(iso: string, today: string): string | null {
  const day = isoDate(iso);
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  if (day === addDays(today, -1)) return "Yesterday";
  return null;
}

/** IST "yyyy-mm-dd" + "HH:mm" → ISO datetime with the +05:30 offset. */
export function istDateTime(date: string, hhmm: string): string {
  return `${date}T${hhmm}:00+05:30`;
}

/** "HH:mm" (24h) of an ISO datetime in IST — for time inputs. */
export function istHhmm(iso: string): string {
  const p = istParts(iso);
  return p ? `${pad2(p.hour)}:${pad2(p.minute)}` : "";
}

/** "12/06/2026, 04:22 PM". */
export function formatDateTime(iso: string): string {
  return `${formatSlashDate(iso)}, ${formatTime(iso)}`;
}

/** ₹4,50,000 (Indian digit grouping). */
export function formatInr(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

/** ₹38.4L above a lakh, ₹45k above a thousand. */
export function formatInrShort(value: number): string {
  if (value >= 100000) return `₹${+(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${Math.round(value / 1000)}k`;
  return `₹${value}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = ["bg-blue-700", "bg-violet-600", "bg-orange-500", "bg-emerald-600", "bg-pink-600", "bg-cyan-600", "bg-indigo-600"];

/** Stable avatar colour per name. */
export function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Digits-only phone for tel: / wa.me links ("+91 98765 43210" → "919876543210"). */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}
