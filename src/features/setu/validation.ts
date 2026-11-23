import { CONTRACT_TERMS, LOSS_REASONS } from "./constants";
import type {
  CallDirection,
  CallOutcome,
  DealInput,
  DealLostDetails,
  DealStage,
  DealWonDetails,
  MeetingAttendee,
  MeetingChannel,
  MeetingReminder,
  MeetingStatus,
  NoteCategory,
} from "./types";

// Server-side checks for every Setu write (the forms validate too, but the server never trusts
// them). Each returns the cleaned value or an error message. Pure — unit-tested.

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Checked<T> => ({ ok: true, value });
const fail = <T>(error: string): Checked<T> => ({ ok: false, error });

const STAGES: readonly DealStage[] = ["LEAD", "MEETING", "DISCUSSION", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"];
const CATEGORIES: readonly NoteCategory[] = ["NOTE", "DISCUSSION", "NEGOTIATION"];
const DIRECTIONS: readonly CallDirection[] = ["OUTBOUND", "INBOUND"];
const OUTCOMES: readonly CallOutcome[] = ["CONNECTED", "INTERESTED", "QUALIFIED", "COMPLETED", "NO_ANSWER"];
const CHANNELS: readonly MeetingChannel[] = ["GOOGLE_MEET", "ZOOM", "TEAMS", "ONLINE", "IN_OFFICE", "CLIENT_LOCATION"];
const REMINDERS: readonly MeetingReminder[] = ["30m", "15m", "1h", "1d"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Values the app accepts in rupees (₹1000 crore cap — keeps us well inside Postgres INT). */
const MAX_INR = 2_000_000_000;

export const isStage = (v: unknown): v is DealStage => STAGES.includes(v as DealStage);
export const isCategory = (v: unknown): v is NoteCategory => CATEGORIES.includes(v as NoteCategory);

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
/** Rich-text / long text fields. */
const longStr = (v: unknown) => str(v, 20_000);

export function isValidDate(v: unknown): v is string {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function isValidDateTime(v: unknown): v is string {
  return typeof v === "string" && v.length >= 16 && !Number.isNaN(Date.parse(v));
}

function money(v: unknown, { required }: { required: boolean }): Checked<number | undefined> {
  if (v === undefined || v === null || v === "") return required ? fail("Enter an amount.") : ok(undefined);
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return fail("Amounts must be zero or more.");
  if (n > MAX_INR) return fail("That amount is too large.");
  return ok(Math.round(n));
}

function url(v: unknown): Checked<string | undefined> {
  const s = str(v, 2000);
  if (!s) return ok(undefined);
  if (!/^https?:\/\/\S+$/i.test(s)) return fail("Links must start with http:// or https://");
  return ok(s);
}

export function checkDealInput(raw: Partial<DealInput>): Checked<DealInput> {
  const company = str(raw.company, 200);
  const contactName = str(raw.contactName, 200);
  const phone = str(raw.phone, 40);
  const email = str(raw.email, 200);
  const location = str(raw.location, 200);
  if (!company) return fail("Company name is required.");
  if (!contactName) return fail("Decision maker is required.");
  if (phone.replace(/\D/g, "").length < 10) return fail("Enter a valid phone number.");
  if (!EMAIL_RE.test(email)) return fail("Enter a valid email.");
  if (!location) return fail("Location is required.");
  if (!isStage(raw.stage)) return fail("Pick a valid stage.");
  const value = money(raw.value, { required: false });
  if (!value.ok) return value;
  return ok({
    company,
    contactName,
    contactRole: str(raw.contactRole, 200) || "Decision Maker",
    phone,
    email,
    location,
    source: str(raw.source, 200),
    stage: raw.stage,
    title: str(raw.title, 300),
    value: value.value,
    remark: str(raw.remark, 500),
  });
}

export function checkNote(raw: { title?: unknown; body?: unknown; pinned?: unknown; category?: unknown }) {
  const title = str(raw.title, 300);
  const body = longStr(raw.body);
  if (!title || !body) return fail<{ title: string; body: string; pinned: boolean; category: NoteCategory }>("Add a title and the text.");
  if (!isCategory(raw.category)) return fail<{ title: string; body: string; pinned: boolean; category: NoteCategory }>("Unknown note type.");
  return ok({ title, body, pinned: raw.pinned === true, category: raw.category });
}

export function checkRequest(raw: { text?: unknown; requestedBy?: unknown }): Checked<{ text: string; requestedBy: string }> {
  const text = str(raw.text, 500);
  const requestedBy = str(raw.requestedBy, 200);
  if (!text || !requestedBy) return fail("Add the request and who asked for it.");
  return ok({ text, requestedBy });
}

export interface CallFields {
  title: string;
  direction: CallDirection;
  outcome: CallOutcome;
  startedAt: string;
  endedAt: string;
  repId: string;
  repRole?: string;
  contactName: string;
  contactRole?: string;
  summary: string;
  recordingUrl?: string;
}

export function checkCall(raw: Partial<CallFields>): Checked<CallFields> {
  const title = str(raw.title, 300);
  const contactName = str(raw.contactName, 200);
  const repId = str(raw.repId, 100);
  if (!title || !contactName || !repId) return fail("Title, rep and contact are required.");
  if (!DIRECTIONS.includes(raw.direction as CallDirection) || !OUTCOMES.includes(raw.outcome as CallOutcome)) return fail("Pick a direction and outcome.");
  if (!isValidDateTime(raw.startedAt) || !isValidDateTime(raw.endedAt)) return fail("Pick the call's date and time.");
  if (Date.parse(raw.endedAt) < Date.parse(raw.startedAt)) return fail("The call can't end before it starts.");
  if (Date.parse(raw.endedAt) - Date.parse(raw.startedAt) > 12 * 3600_000) return fail("A call can't be longer than 12 hours.");
  const rec = url(raw.recordingUrl);
  if (!rec.ok) return rec;
  return ok({
    title,
    direction: raw.direction as CallDirection,
    outcome: raw.outcome as CallOutcome,
    startedAt: raw.startedAt,
    endedAt: raw.endedAt,
    repId,
    repRole: str(raw.repRole, 200) || undefined,
    contactName,
    contactRole: str(raw.contactRole, 200) || undefined,
    summary: longStr(raw.summary),
    recordingUrl: rec.value,
  });
}

export interface MeetingFields {
  title: string;
  type: string;
  startAt: string;
  endAt: string;
  channel: MeetingChannel;
  link?: string;
  location?: string;
  agenda: string;
  attendees: Omit<MeetingAttendee, "id">[];
  reminder: MeetingReminder;
  summary?: string;
  recordingUrl?: string;
}

export function checkAttendee(raw: Partial<MeetingAttendee>): Checked<Omit<MeetingAttendee, "id">> {
  const name = str(raw.name, 200);
  if (!name) return fail("Every attendee needs a name.");
  const email = str(raw.email, 200);
  if (email && !EMAIL_RE.test(email)) return fail(`${name}: invalid email.`);
  const external = raw.external === true;
  if (!external && !raw.userId) return fail(`${name}: team attendees must be WinOS users.`);
  return ok({
    userId: external ? undefined : str(raw.userId, 100),
    name,
    role: str(raw.role, 200) || undefined,
    email: email || undefined,
    company: str(raw.company, 200) || undefined,
    external,
    source: raw.source && ["LEAD", "DEAL", "GUEST", "TEAM"].includes(raw.source) ? raw.source : external ? "GUEST" : "TEAM",
    rsvp: raw.rsvp && ["PENDING", "ACCEPTED", "DECLINED"].includes(raw.rsvp) ? raw.rsvp : "PENDING",
    attended: typeof raw.attended === "boolean" ? raw.attended : undefined,
  });
}

/** `status` decides how strict: drafts only need a title. */
export function checkMeeting(raw: Partial<MeetingFields>, status: MeetingStatus): Checked<MeetingFields> {
  const title = str(raw.title, 300);
  if (!title) return fail("Meeting title is required.");
  if (!CHANNELS.includes(raw.channel as MeetingChannel)) return fail("Pick a meeting type.");
  if (!isValidDateTime(raw.startAt) || !isValidDateTime(raw.endAt)) return fail("Pick the date and time.");
  if (status !== "DRAFT" && Date.parse(raw.endAt) <= Date.parse(raw.startAt)) return fail("End time must be after the start time.");
  const link = url(raw.link);
  if (!link.ok) return link;
  const online = raw.channel !== "IN_OFFICE" && raw.channel !== "CLIENT_LOCATION";
  const location = str(raw.location, 300);
  if (!online && !location && status !== "DRAFT") return fail("Add the meeting location.");
  const rec = url(raw.recordingUrl);
  if (!rec.ok) return rec;
  const attendees: Omit<MeetingAttendee, "id">[] = [];
  for (const a of Array.isArray(raw.attendees) ? raw.attendees.slice(0, 100) : []) {
    const c = checkAttendee(a);
    if (!c.ok) return c;
    attendees.push(c.value);
  }
  return ok({
    title,
    type: str(raw.type, 100) || "Meeting",
    startAt: raw.startAt,
    endAt: raw.endAt,
    channel: raw.channel as MeetingChannel,
    link: online ? link.value : undefined,
    location: online ? undefined : location || undefined,
    agenda: longStr(raw.agenda),
    attendees,
    reminder: REMINDERS.includes(raw.reminder as MeetingReminder) ? (raw.reminder as MeetingReminder) : "30m",
    summary: raw.summary === undefined ? undefined : longStr(raw.summary),
    recordingUrl: rec.value,
  });
}

export function checkProposal(raw: { title?: unknown; value?: unknown; reason?: unknown }): Checked<{ title: string; value: number; reason: string }> {
  const title = str(raw.title, 300);
  if (!title) return fail("Proposal scope title is required.");
  const value = money(raw.value, { required: true });
  if (!value.ok) return value as Checked<never>;
  if (!value.value) return fail("Enter the commercial quote.");
  return ok({ title, value: value.value, reason: longStr(raw.reason) });
}

export function checkWon(raw: Partial<DealWonDetails>): Checked<Omit<DealWonDetails, "documents">> {
  const finalValue = money(raw.finalValue, { required: true });
  if (!finalValue.ok) return finalValue as Checked<never>;
  if (!finalValue.value) return fail("Enter the final deal value.");
  const advance = money(raw.advanceReceived, { required: true });
  if (!advance.ok) return advance as Checked<never>;
  if ((advance.value ?? 0) > finalValue.value) return fail("Advance can't be more than the final deal value.");
  if (!isValidDate(raw.closedDate)) return fail("Pick the closed date.");
  const contractTerm = str(raw.contractTerm, 200);
  if (!(CONTRACT_TERMS as readonly string[]).includes(contractTerm)) return fail("Pick a contract term.");
  const paymentTerms = str(raw.paymentTerms, 300);
  if (!paymentTerms) return fail("Enter the payment terms.");
  return ok({ finalValue: finalValue.value, advanceReceived: advance.value ?? 0, closedDate: raw.closedDate, contractTerm, paymentTerms });
}

export function checkLost(raw: Partial<DealLostDetails>): Checked<DealLostDetails> {
  const primaryReason = str(raw.primaryReason, 200);
  if (!(LOSS_REASONS as readonly string[]).includes(primaryReason)) return fail("Pick the primary loss reason.");
  const value = money(raw.lostValue, { required: false });
  if (!value.ok) return value as Checked<never>;
  if (!isValidDate(raw.closedDate)) return fail("Pick the closed lost date.");
  if (raw.reengageDate !== undefined && raw.reengageDate !== "" && !isValidDate(raw.reengageDate)) return fail("Invalid re-engagement date.");
  const reengageDate = raw.reengageDate || undefined;
  if (reengageDate && reengageDate < raw.closedDate) return fail("Re-engagement date should be after the closed date.");
  return ok({
    lostValue: value.value ?? 0,
    primaryReason,
    secondaryFactor: str(raw.secondaryFactor, 300),
    closedDate: raw.closedDate,
    analysis: longStr(raw.analysis),
    reengageDate,
    reengageNote: str(raw.reengageNote, 200),
    keepNurturing: raw.keepNurturing !== false,
  });
}
