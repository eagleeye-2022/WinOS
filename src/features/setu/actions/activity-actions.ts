"use server";

import { db } from "@/lib/db";
import type { ActiveTimer, DealCall, DealNote, DealTimeLog, NegotiationRequest, NoteCategory } from "../types";
import { checkCall, checkNote, checkRequest, type CallFields } from "../validation";
import { callInclude, loadDealRequests, noteInclude, timeLogInclude, toCall, toNote, toTimeLog } from "../server/data";
import { areTeamMembers, failure, revalidateSetu, success, withSetuUser, type ActionResult } from "../server/guard";

const dealExists = async (dealId: string) => Boolean(await db.crmDeal.findUnique({ where: { id: dealId }, select: { id: true } }));

// ── Notes / Discussions / Negotiation updates ─────────────────────────────────

export async function addNoteAction(dealId: string, note: { title: string; body: string; pinned: boolean; category: NoteCategory }): Promise<ActionResult<DealNote>> {
  return withSetuUser("addNote", async (me) => {
    const checked = checkNote(note);
    if (!checked.ok) return failure(checked.error);
    if (!(await dealExists(dealId))) return failure("This deal no longer exists.");
    const row = await db.crmNote.create({ data: { ...checked.value, dealId, authorId: me.id }, include: noteInclude });
    revalidateSetu();
    return success(toNote(row));
  });
}

export async function updateNoteAction(noteId: string, patch: { title?: string; body?: string; pinned?: boolean }): Promise<ActionResult<DealNote>> {
  return withSetuUser("updateNote", async () => {
    const current = await db.crmNote.findUnique({ where: { id: noteId } });
    if (!current) return failure("This note no longer exists.");
    const checked = checkNote({
      title: patch.title ?? current.title,
      body: patch.body ?? current.body,
      pinned: patch.pinned ?? current.pinned,
      category: current.category,
    });
    if (!checked.ok) return failure(checked.error);
    const { title, body, pinned } = checked.value;
    const row = await db.crmNote.update({ where: { id: noteId }, data: { title, body, pinned }, include: noteInclude });
    revalidateSetu();
    return success(toNote(row));
  });
}

export async function deleteNoteAction(noteId: string): Promise<ActionResult<{ id: string }>> {
  return withSetuUser("deleteNote", async () => {
    await db.crmNote.deleteMany({ where: { id: noteId } });
    revalidateSetu();
    return success({ id: noteId });
  });
}

// ── Negotiation requests ──────────────────────────────────────────────────────

/** Returns the deal's full request list (levels may be renumbered). */
export async function addRequestAction(dealId: string, request: { text: string; requestedBy: string }): Promise<ActionResult<NegotiationRequest[]>> {
  return withSetuUser("addRequest", async () => {
    const checked = checkRequest(request);
    if (!checked.ok) return failure(checked.error);
    if (!(await dealExists(dealId))) return failure("This deal no longer exists.");
    const top = await db.crmNegotiationRequest.aggregate({ where: { dealId }, _max: { level: true } });
    await db.crmNegotiationRequest.create({ data: { ...checked.value, dealId, level: (top._max.level ?? 0) + 1 } });
    revalidateSetu();
    return success(await loadDealRequests(dealId));
  });
}

export async function updateRequestAction(requestId: string, request: { text: string; requestedBy: string }): Promise<ActionResult<NegotiationRequest[]>> {
  return withSetuUser("updateRequest", async () => {
    const checked = checkRequest(request);
    if (!checked.ok) return failure(checked.error);
    const current = await db.crmNegotiationRequest.findUnique({ where: { id: requestId }, select: { dealId: true } });
    if (!current) return failure("This request no longer exists.");
    await db.crmNegotiationRequest.update({ where: { id: requestId }, data: checked.value });
    revalidateSetu();
    return success(await loadDealRequests(current.dealId));
  });
}

/** Deletes a request and renumbers the deal's remaining levels 1…n. */
export async function deleteRequestAction(requestId: string): Promise<ActionResult<NegotiationRequest[]>> {
  return withSetuUser("deleteRequest", async () => {
    const current = await db.crmNegotiationRequest.findUnique({ where: { id: requestId }, select: { dealId: true } });
    if (!current) return failure("This request no longer exists.");
    const rest = await db.crmNegotiationRequest.findMany({ where: { dealId: current.dealId, NOT: { id: requestId } }, orderBy: { level: "asc" }, select: { id: true, level: true } });
    await db.$transaction([
      db.crmNegotiationRequest.delete({ where: { id: requestId } }),
      ...rest.map((r, i) => db.crmNegotiationRequest.update({ where: { id: r.id }, data: { level: i + 1 } })),
    ]);
    revalidateSetu();
    return success(await loadDealRequests(current.dealId));
  });
}

// ── Time tracking ─────────────────────────────────────────────────────────────

/** Starts the signed-in user's deal timer (one at a time). */
export async function startTimerAction(dealId: string): Promise<ActionResult<ActiveTimer>> {
  return withSetuUser("startTimer", async (me) => {
    if (!(await dealExists(dealId))) return failure("This deal no longer exists.");
    const running = await db.crmActiveTimer.findUnique({ where: { userId: me.id } });
    if (running) return failure("You already have a timer running. Stop it first.");
    const t = await db.crmActiveTimer.create({ data: { userId: me.id, dealId } });
    revalidateSetu();
    return success({ dealId: t.dealId, userId: me.id, employeeName: me.name, startedAt: t.startedAt.toISOString() });
  });
}

/** Stops the user's timer and saves the session with `reason`. */
export async function stopTimerAction(reason: string): Promise<ActionResult<DealTimeLog>> {
  return withSetuUser("stopTimer", async (me) => {
    const why = typeof reason === "string" ? reason.trim().slice(0, 300) : "";
    if (!why) return failure("Say what the time was spent on.");
    const timer = await db.crmActiveTimer.findUnique({ where: { userId: me.id } });
    if (!timer) return failure("No timer is running.");
    const endedAt = new Date();
    const [row] = await db.$transaction([
      db.crmTimeLog.create({ data: { dealId: timer.dealId, userId: me.id, reason: why, startedAt: timer.startedAt, endedAt }, include: timeLogInclude }),
      db.crmActiveTimer.delete({ where: { userId: me.id } }),
    ]);
    revalidateSetu();
    return success(toTimeLog(row));
  });
}

export async function discardTimerAction(): Promise<ActionResult<null>> {
  return withSetuUser("discardTimer", async (me) => {
    await db.crmActiveTimer.deleteMany({ where: { userId: me.id } });
    revalidateSetu();
    return success(null);
  });
}

export async function deleteTimeLogAction(logId: string): Promise<ActionResult<{ id: string }>> {
  return withSetuUser("deleteTimeLog", async () => {
    await db.crmTimeLog.deleteMany({ where: { id: logId } });
    revalidateSetu();
    return success({ id: logId });
  });
}

// ── Calls ─────────────────────────────────────────────────────────────────────

function callData(c: CallFields) {
  return {
    title: c.title,
    direction: c.direction,
    outcome: c.outcome,
    startedAt: new Date(c.startedAt),
    endedAt: new Date(c.endedAt),
    repId: c.repId,
    repRole: c.repRole ?? null,
    contactName: c.contactName,
    contactRole: c.contactRole ?? null,
    summary: c.summary,
    recordingUrl: c.recordingUrl ?? null,
  };
}

export async function logCallAction(dealId: string, call: CallFields): Promise<ActionResult<DealCall>> {
  return withSetuUser("logCall", async () => {
    const checked = checkCall(call);
    if (!checked.ok) return failure(checked.error);
    if (!(await dealExists(dealId))) return failure("This deal no longer exists.");
    if (!(await areTeamMembers([checked.value.repId]))) return failure("Pick a rep from the team.");
    const row = await db.crmCall.create({ data: { ...callData(checked.value), dealId }, include: callInclude });
    revalidateSetu();
    return success(toCall(row));
  });
}

export async function updateCallAction(callId: string, call: CallFields): Promise<ActionResult<DealCall>> {
  return withSetuUser("updateCall", async () => {
    const checked = checkCall(call);
    if (!checked.ok) return failure(checked.error);
    if (!(await areTeamMembers([checked.value.repId]))) return failure("Pick a rep from the team.");
    const exists = await db.crmCall.findUnique({ where: { id: callId }, select: { id: true } });
    if (!exists) return failure("This call no longer exists.");
    const row = await db.crmCall.update({ where: { id: callId }, data: callData(checked.value), include: callInclude });
    revalidateSetu();
    return success(toCall(row));
  });
}

export async function deleteCallAction(callId: string): Promise<ActionResult<{ id: string }>> {
  return withSetuUser("deleteCall", async () => {
    await db.crmCall.deleteMany({ where: { id: callId } });
    revalidateSetu();
    return success({ id: callId });
  });
}
