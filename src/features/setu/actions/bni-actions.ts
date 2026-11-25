"use server";

import { db } from "@/lib/db";
import type { Prisma } from "../../../../generated/prisma/client";
import {
  NOTE_REF_IN,
  NOTE_REF_OUT,
  NOTE_TODO,
  NOTE_TODO_DONE,
  applyBniStage,
  bniStageOf,
  checkLog121,
  checkMember,
  checkProspect,
  checkReferral,
  decodeReferral,
  decodeRole,
  encodeReferral,
  encodeRole,
  isBniStage,
  isRefIn,
  stageForNew,
  textToHtml,
  type BniPatch,
  type BniStage,
  type Log121Input,
  type MemberInput,
  type PersonInput,
  type ProspectInput,
  type ReferralDetails,
  type ReferralInput,
} from "../bni";
import { isoDate, istDateTime, nextCode } from "../utils";
import { dealInclude, meetingInclude, noteInclude, toDeal, toMeeting, toNote } from "../server/data";
import { failure, revalidateSetu, success, withSetuUser, type ActionResult } from "../server/guard";
import { stageFields, withCodeRetry } from "../server/stage";

// Server actions for Setu's BNI layer (121 Meetings, Referrals, the 12-stage pipeline). Storage
// conventions are described at the top of ../bni.ts. Each returns the records it wrote (a
// BniPatch) for the client store to merge; the layout snapshot also refreshes (revalidateSetu).

type Tx = Prisma.TransactionClient;

const MEMBER_ROLE = "BNI Member";
const EMPTY_PATCH: BniPatch = { deals: [], notes: [], meetings: [], removedNoteIds: [] };
const patch = (p: Partial<BniPatch>): BniPatch => ({ ...EMPTY_PATCH, ...p });

/** `n` consecutive free LD- codes for this (IST) year, read inside the transaction. */
async function leadCodes(tx: Tx, n: number): Promise<string[]> {
  if (n <= 0) return [];
  const year = Number(isoDate(new Date()).slice(0, 4));
  const last = await tx.crmDeal.findFirst({ where: { leadCode: { startsWith: `LD-${year}-` } }, orderBy: { leadCode: "desc" }, select: { leadCode: true } });
  const first = Number(nextCode("LD", [last?.leadCode], year).slice(-4));
  return Array.from({ length: n }, (_, i) => `LD-${year}-${String(first + i).padStart(4, "0")}`);
}

/** Person fields → CrmDeal columns. `company` falls back to the name (it's required in the table). */
function personColumns(p: PersonInput) {
  return { contactName: p.name, company: p.business || p.name, phone: p.phone, email: p.email, location: p.address, source: p.via };
}

async function loadDeals(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.crmDeal.findMany({ where: { id: { in: ids } }, include: dealInclude });
  return rows.map(toDeal);
}
async function loadNotes(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.crmNote.findMany({ where: { id: { in: ids } }, include: noteInclude });
  return rows.map(toNote);
}

async function memberRow(id: string) {
  const row = await db.crmDeal.findUnique({ where: { id }, select: { id: true, contactName: true, contactRole: true } });
  return row && decodeRole(row.contactRole).tags.kind === "MEMBER" ? row : null;
}

/** Interactive-transaction limits: batch writes to the cloud DB can take longer than Prisma's 5s default. */
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

/** New prospects from received referrals (in the Prospect column, marked as from a 121), ids in input order. */
async function createReferralProspects(tx: Tx, me: string, memberName: string, items: ReferralDetails[]) {
  if (!items.length) return [];
  const codes = await leadCodes(tx, items.length);
  const rows = await tx.crmDeal.createManyAndReturn({
    data: items.map((r, i) => ({
      leadCode: codes[i],
      contactName: r.name,
      company: r.business || r.name,
      phone: r.phone,
      email: "",
      location: "",
      source: r.via || memberName,
      contactRole: encodeRole("", { kind: "PROSPECT", origin: "121", hold: false }),
      remark: `Referral from 121 with ${memberName}`,
      stage: "LEAD" as const,
      ownerId: me,
      createdById: me,
    })),
    select: { id: true, leadCode: true },
  });
  // Map back by the (unique) lead code — RETURNING order isn't guaranteed.
  const byCode = new Map(rows.map((r) => [r.leadCode, r.id]));
  return codes.map((c) => byCode.get(c) as string);
}

// ── Prospects & opportunity cards ─────────────────────────────────────────────

export async function createProspectAction(input: ProspectInput): Promise<ActionResult<BniPatch>> {
  return withSetuUser("createProspect", async (me) => {
    const checked = checkProspect(input);
    if (!checked.ok) return failure(checked.error);
    const p = checked.value;
    const { stage, tags } = stageForNew(p.stage, p.kind, p.origin);
    const row = await withCodeRetry(async () =>
      db.$transaction(async (tx) => {
        const [leadCode] = await leadCodes(tx, 1);
        return tx.crmDeal.create({
          data: {
            ...personColumns(p),
            leadCode,
            title: p.need,
            remark: p.remark,
            contactRole: encodeRole("", tags),
            ...(await stageFields(null, stage)),
            ownerId: me.id,
            createdById: me.id,
          },
          include: dealInclude,
        });
      }, TX_OPTIONS)
    );
    revalidateSetu();
    return success(patch({ deals: [toDeal(row)] }));
  });
}

export async function updateProspectAction(dealId: string, input: ProspectInput): Promise<ActionResult<BniPatch>> {
  return withSetuUser("updateProspect", async () => {
    const checked = checkProspect(input);
    if (!checked.ok) return failure(checked.error);
    const current = await db.crmDeal.findUnique({ where: { id: dealId }, select: { stage: true, dealCode: true, contactRole: true } });
    if (!current) return failure("This record no longer exists.");
    const p = checked.value;
    const { role, tags } = decodeRole(current.contactRole);
    if (tags.kind === "MEMBER") return failure("That's a BNI member — edit it from 121 Meetings.");
    const before = bniStageOf({ stage: current.stage, bni: tags });
    const target = p.kind === "OPPORTUNITY" ? "OPPORTUNITY" : p.stage === "OPPORTUNITY" ? "PROSPECT" : p.stage;
    const next = before === target ? { stage: current.stage, tags } : applyBniStage({ stage: current.stage, tags }, target);
    const row = await withCodeRetry(async () =>
      db.crmDeal.update({
        where: { id: dealId },
        data: {
          ...personColumns(p),
          title: p.need,
          remark: p.remark,
          contactRole: encodeRole(role, { ...next.tags, origin: p.origin }),
          ...(await stageFields(current, next.stage)),
        },
        include: dealInclude,
      })
    );
    revalidateSetu();
    return success(patch({ deals: [toDeal(row)] }));
  });
}

/** Drag on the Sales Pipeline board: one of the 12 columns. */
export async function setBniStageAction(dealId: string, target: BniStage): Promise<ActionResult<BniPatch>> {
  return withSetuUser("setBniStage", async () => {
    if (!isBniStage(target)) return failure("Unknown stage.");
    const current = await db.crmDeal.findUnique({ where: { id: dealId }, select: { stage: true, dealCode: true, contactRole: true } });
    if (!current) return failure("This record no longer exists.");
    const { role, tags } = decodeRole(current.contactRole);
    if (tags.kind === "MEMBER") return failure("BNI members aren't on the pipeline — convert their referrals instead.");
    const next = applyBniStage({ stage: current.stage, tags }, target);
    const row = await withCodeRetry(async () =>
      db.crmDeal.update({
        where: { id: dealId },
        data: { ...(await stageFields(current, next.stage)), contactRole: encodeRole(role, next.tags) },
        include: dealInclude,
      })
    );
    revalidateSetu();
    return success(patch({ deals: [toDeal(row)] }));
  });
}

// ── Members & 121 meetings ────────────────────────────────────────────────────

export async function createMemberAction(input: MemberInput): Promise<ActionResult<BniPatch>> {
  return withSetuUser("createMember", async (me) => {
    const checked = checkMember(input);
    if (!checked.ok) return failure(checked.error);
    const row = await withCodeRetry(async () =>
      db.$transaction(async (tx) => {
        const [leadCode] = await leadCodes(tx, 1);
        return tx.crmDeal.create({
          data: {
            ...personColumns(checked.value),
            leadCode,
            contactRole: encodeRole(MEMBER_ROLE, { kind: "MEMBER", origin: "DIRECT", hold: false }),
            stage: "LEAD",
            ownerId: me.id,
            createdById: me.id,
          },
          include: dealInclude,
        });
      }, TX_OPTIONS)
    );
    revalidateSetu();
    return success(patch({ deals: [toDeal(row)] }));
  });
}

export async function updateMemberAction(memberId: string, input: MemberInput): Promise<ActionResult<BniPatch>> {
  return withSetuUser("updateMember", async () => {
    const checked = checkMember(input);
    if (!checked.ok) return failure(checked.error);
    const current = await memberRow(memberId);
    if (!current) return failure("This member no longer exists.");
    const { role, tags } = decodeRole(current.contactRole);
    const row = await db.crmDeal.update({
      where: { id: memberId },
      data: { ...personColumns(checked.value), contactRole: encodeRole(role || MEMBER_ROLE, tags) },
      include: dealInclude,
    });
    revalidateSetu();
    return success(patch({ deals: [toDeal(row)] }));
  });
}

/**
 * "Log 121 Meeting": the member (new or existing), the meeting with its notes, one referral note
 * per referral received / given, and — with `convert` — named referrals as prospects.
 */
export async function log121Action(input: Log121Input): Promise<ActionResult<BniPatch>> {
  return withSetuUser("log121", async (me) => {
    const checked = checkLog121(input);
    if (!checked.ok) return failure(checked.error);
    const v = checked.value;
    if (v.memberId && !(await memberRow(v.memberId))) return failure("That member no longer exists.");

    const result = await withCodeRetry(async () =>
      db.$transaction(async (tx) => {
        let memberId = v.memberId;
        let memberName = "";
        const dealIds: string[] = [];
        if (!memberId && v.member) {
          const [leadCode] = await leadCodes(tx, 1);
          const m = await tx.crmDeal.create({
            data: {
              ...personColumns(v.member),
              leadCode,
              contactRole: encodeRole(MEMBER_ROLE, { kind: "MEMBER", origin: "DIRECT", hold: false }),
              stage: "LEAD",
              ownerId: me.id,
              createdById: me.id,
            },
            select: { id: true, contactName: true },
          });
          memberId = m.id;
          memberName = m.contactName;
        } else {
          const m = await tx.crmDeal.findUniqueOrThrow({ where: { id: memberId }, select: { contactName: true } });
          memberName = m.contactName;
        }
        dealIds.push(memberId as string);

        const startAt = new Date(istDateTime(v.date, "10:00"));
        const meeting = await tx.crmMeeting.create({
          data: {
            dealId: memberId as string,
            title: `${v.type} — ${memberName}`,
            type: v.type,
            startAt,
            endAt: new Date(startAt.getTime() + 3600_000),
            hostId: me.id,
            channel: "IN_OFFICE",
            location: "BNI",
            agenda: textToHtml(v.notes),
            status: v.date > isoDate(new Date()) ? "UPCOMING" : "COMPLETED",
            attendees: { create: [{ name: memberName, role: MEMBER_ROLE, external: true, source: "LEAD", rsvp: "ACCEPTED", attended: v.date <= isoDate(new Date()) ? true : null }] },
            events: {
              create: [
                {
                  title: `${v.type} logged`,
                  detail: `${v.refsReceived} referral(s) received, ${v.refsGiven} given.`,
                  tone: "GREEN",
                },
              ],
            },
          },
          select: { id: true },
        });

        // Received referrals: named ones first, the rest as "Referral n" placeholders to fill in later.
        const received: ReferralDetails[] = Array.from({ length: v.refsReceived }, (_, i) => ({
          name: v.referralNames[i] ?? "",
          business: "",
          phone: "",
          via: "",
        }));
        const toConvert = v.convert ? received.filter((r) => r.name) : [];
        const prospectIds = await createReferralProspects(tx, me.id, memberName, toConvert);
        dealIds.push(...prospectIds);
        let converted = 0;
        const noteData = [
          ...received.map((r, i) => {
            const prospectId = r.name && v.convert ? prospectIds[converted++] : undefined;
            return {
              dealId: memberId as string,
              category: "NOTE" as const,
              title: prospectId ? `${NOTE_REF_IN}>${prospectId}` : NOTE_REF_IN,
              body: encodeReferral({ ...r, name: r.name || `Referral ${i + 1}` }),
              authorId: me.id,
            };
          }),
          ...Array.from({ length: v.refsGiven }, () => ({
            dealId: memberId as string,
            category: "NOTE" as const,
            title: NOTE_REF_OUT,
            body: encodeReferral({ name: memberName, business: "" }),
            authorId: me.id,
          })),
        ];
        const notes = noteData.length ? await tx.crmNote.createManyAndReturn({ data: noteData, select: { id: true } }) : [];
        await tx.crmDeal.update({ where: { id: memberId }, data: { updatedAt: new Date() } });
        return { dealIds, meetingId: meeting.id, noteIds: notes.map((n) => n.id) };
      }, TX_OPTIONS)
    );

    revalidateSetu();
    const m = await db.crmMeeting.findUnique({ where: { id: result.meetingId }, include: meetingInclude });
    return success(
      patch({ deals: await loadDeals(result.dealIds), notes: await loadNotes(result.noteIds), meetings: m ? [toMeeting(m)] : [] })
    );
  });
}

// ── Referrals ─────────────────────────────────────────────────────────────────

/** Turns a member's pending received referrals into prospects (details can be filled in here). */
export async function convertReferralsAction(memberId: string, items: { noteId: string; details: ReferralDetails }[]): Promise<ActionResult<BniPatch>> {
  return withSetuUser("convertReferrals", async (me) => {
    const member = await memberRow(memberId);
    if (!member) return failure("This member no longer exists.");
    const list = Array.isArray(items) ? items.slice(0, 50) : [];
    if (!list.length) return failure("Pick at least one referral to convert.");
    const notes = await db.crmNote.findMany({ where: { id: { in: list.map((i) => i.noteId) }, dealId: memberId } });
    const pending = new Map(notes.filter((n) => n.title === NOTE_REF_IN).map((n) => [n.id, n]));
    const work: { noteId: string; details: ReferralDetails }[] = [];
    for (const item of list) {
      const note = pending.get(item.noteId);
      if (!note) continue;
      const checked = checkReferral({ direction: "RECEIVED", memberId, details: { ...decodeReferral(note.body), ...item.details }, convert: true });
      if (!checked.ok) return failure(checked.error);
      work.push({ noteId: note.id, details: checked.value.details });
    }
    if (!work.length) return failure("Those referrals were already converted.");

    const ids = await withCodeRetry(async () =>
      db.$transaction(async (tx) => {
        const prospectIds = await createReferralProspects(tx, me.id, member.contactName, work.map((w) => w.details));
        for (const [i, w] of work.entries()) {
          await tx.crmNote.update({ where: { id: w.noteId }, data: { title: `${NOTE_REF_IN}>${prospectIds[i]}`, body: encodeReferral(w.details) } });
        }
        return prospectIds;
      }, TX_OPTIONS)
    );
    revalidateSetu();
    return success(patch({ deals: await loadDeals(ids), notes: await loadNotes(work.map((w) => w.noteId)) }));
  });
}

/** "+ Log Referral": one referral received from / given to a member (created if new). */
export async function logReferralAction(input: ReferralInput): Promise<ActionResult<BniPatch>> {
  return withSetuUser("logReferral", async (me) => {
    const checked = checkReferral(input);
    if (!checked.ok) return failure(checked.error);
    const v = checked.value;
    if (v.memberId && !(await memberRow(v.memberId))) return failure("That member no longer exists.");

    const result = await withCodeRetry(async () =>
      db.$transaction(async (tx) => {
        const dealIds: string[] = [];
        let memberId = v.memberId;
        let memberName = "";
        if (memberId) {
          memberName = (await tx.crmDeal.findUniqueOrThrow({ where: { id: memberId }, select: { contactName: true } })).contactName;
        } else {
          const [leadCode] = await leadCodes(tx, 1);
          const m = await tx.crmDeal.create({
            data: {
              ...personColumns({ name: v.memberName ?? "", business: "", phone: "", email: "", address: "", via: "" }),
              leadCode,
              contactRole: encodeRole(MEMBER_ROLE, { kind: "MEMBER", origin: "DIRECT", hold: false }),
              stage: "LEAD",
              ownerId: me.id,
              createdById: me.id,
            },
            select: { id: true, contactName: true },
          });
          memberId = m.id;
          memberName = m.contactName;
          dealIds.push(m.id);
        }
        const [prospectId] = v.convert ? await createReferralProspects(tx, me.id, memberName, [v.details]) : [];
        if (prospectId) dealIds.push(prospectId);
        const note = await tx.crmNote.create({
          data: {
            dealId: memberId as string,
            category: "NOTE",
            title: v.direction === "GIVEN" ? NOTE_REF_OUT : prospectId ? `${NOTE_REF_IN}>${prospectId}` : NOTE_REF_IN,
            body: encodeReferral(v.details),
            authorId: me.id,
          },
          select: { id: true },
        });
        return { dealIds, noteId: note.id };
      }, TX_OPTIONS)
    );
    revalidateSetu();
    return success(patch({ deals: await loadDeals(result.dealIds), notes: await loadNotes([result.noteId]) }));
  });
}

/** Bot "ref recv [n] from [name]" / "ref gave [n] to [name]": n unnamed referrals on a member (created if new). */
export async function addReferralCountAction(input: { memberId?: string; memberName?: string; direction: "RECEIVED" | "GIVEN"; count: number }): Promise<ActionResult<BniPatch>> {
  return withSetuUser("addReferralCount", async (me) => {
    const n = Math.floor(Number(input?.count));
    if (!Number.isFinite(n) || n < 1 || n > 50) return failure("Referral count must be 1–50.");
    const direction = input.direction === "GIVEN" ? "GIVEN" : "RECEIVED";
    const memberName = typeof input.memberName === "string" ? input.memberName.trim().slice(0, 200) : "";
    if (input.memberId && !(await memberRow(input.memberId))) return failure("That member no longer exists.");
    if (!input.memberId && !memberName) return failure("Name the member.");

    const result = await withCodeRetry(async () =>
      db.$transaction(async (tx) => {
        const dealIds: string[] = [];
        let memberId = input.memberId;
        let name = memberName;
        if (!memberId) {
          const [leadCode] = await leadCodes(tx, 1);
          const m = await tx.crmDeal.create({
            data: {
              ...personColumns({ name: memberName, business: "", phone: "", email: "", address: "", via: "" }),
              leadCode,
              contactRole: encodeRole(MEMBER_ROLE, { kind: "MEMBER", origin: "BOT", hold: false }),
              stage: "LEAD",
              ownerId: me.id,
              createdById: me.id,
            },
            select: { id: true },
          });
          memberId = m.id;
          dealIds.push(m.id);
        } else {
          name = (await tx.crmDeal.findUniqueOrThrow({ where: { id: memberId }, select: { contactName: true } })).contactName;
        }
        const notes = await tx.crmNote.createManyAndReturn({
          data: Array.from({ length: n }, (_, i) => ({
            dealId: memberId as string,
            category: "NOTE" as const,
            title: direction === "GIVEN" ? NOTE_REF_OUT : NOTE_REF_IN,
            body: encodeReferral({ name: direction === "GIVEN" ? name : `Referral ${i + 1}` }),
            authorId: me.id,
          })),
          select: { id: true },
        });
        return { dealIds, noteIds: notes.map((x) => x.id) };
      }, TX_OPTIONS)
    );
    revalidateSetu();
    return success(patch({ deals: await loadDeals(result.dealIds), notes: await loadNotes(result.noteIds) }));
  });
}

/** Edits a referral's details (name / business / phone / via). */
export async function updateReferralAction(noteId: string, details: ReferralDetails): Promise<ActionResult<BniPatch>> {
  return withSetuUser("updateReferral", async () => {
    const note = await db.crmNote.findUnique({ where: { id: noteId } });
    if (!note || !(isRefIn(note) || note.title === NOTE_REF_OUT)) return failure("This referral no longer exists.");
    const checked = checkReferral({ direction: note.title === NOTE_REF_OUT ? "GIVEN" : "RECEIVED", memberId: note.dealId, details, convert: false });
    if (!checked.ok) return failure(checked.error);
    const row = await db.crmNote.update({ where: { id: noteId }, data: { body: encodeReferral(checked.value.details) }, include: noteInclude });
    revalidateSetu();
    return success(patch({ notes: [toNote(row)] }));
  });
}

// ── To-dos ────────────────────────────────────────────────────────────────────

export async function addTodoAction(memberId: string, text: string): Promise<ActionResult<BniPatch>> {
  return withSetuUser("addTodo", async (me) => {
    const body = typeof text === "string" ? text.trim().slice(0, 500) : "";
    if (!body) return failure("Write the to-do.");
    if (!(await memberRow(memberId))) return failure("This member no longer exists.");
    const row = await db.crmNote.create({ data: { dealId: memberId, category: "NOTE", title: NOTE_TODO, body, authorId: me.id }, include: noteInclude });
    revalidateSetu();
    return success(patch({ notes: [toNote(row)] }));
  });
}

export async function toggleTodoAction(noteId: string): Promise<ActionResult<BniPatch>> {
  return withSetuUser("toggleTodo", async () => {
    const note = await db.crmNote.findUnique({ where: { id: noteId }, select: { title: true } });
    if (!note || (note.title !== NOTE_TODO && note.title !== NOTE_TODO_DONE)) return failure("This to-do no longer exists.");
    const row = await db.crmNote.update({ where: { id: noteId }, data: { title: note.title === NOTE_TODO ? NOTE_TODO_DONE : NOTE_TODO }, include: noteInclude });
    revalidateSetu();
    return success(patch({ notes: [toNote(row)] }));
  });
}

/** Removes a to-do or a referral note (a converted referral's prospect stays on the pipeline). */
export async function deleteBniNoteAction(noteId: string): Promise<ActionResult<BniPatch>> {
  return withSetuUser("deleteBniNote", async () => {
    await db.crmNote.deleteMany({ where: { id: noteId, title: { startsWith: "bni:" } } });
    revalidateSetu();
    return success(patch({ removedNoteIds: [noteId] }));
  });
}
