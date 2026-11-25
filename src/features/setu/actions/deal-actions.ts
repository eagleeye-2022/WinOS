"use server";

import { db } from "@/lib/db";
import type { Deal, DealFile, DealInput, DealLostDetails, DealStage, DealWonDetails } from "../types";
import { decodeRole, encodeRole } from "../bni";
import { checkDealInput, checkLost, checkWon, isStage } from "../validation";
import { dayToDate, dealInclude, loadDeal, toDeal } from "../server/data";
import { failure, nextDealCode, revalidateSetu, success, withSetuUser, type ActionResult } from "../server/guard";
import { checkUploadedFiles } from "../server/files";
import { stageFields, withCodeRetry } from "../server/stage";

export async function createDealAction(input: DealInput): Promise<ActionResult<Deal>> {
  return withSetuUser("createDeal", async (me) => {
    const checked = checkDealInput(input);
    if (!checked.ok) return failure(checked.error);
    const { stage, value, ...rest } = checked.value;
    const row = await withCodeRetry(async () =>
      db.crmDeal.create({
        data: {
          ...rest,
          value: value ?? null,
          leadCode: await nextDealCode("LD"),
          ...(await stageFields(null, stage)),
          ownerId: me.id,
          createdById: me.id,
        },
        include: dealInclude,
      })
    );
    revalidateSetu();
    return success(toDeal(row));
  });
}

export async function updateDealAction(dealId: string, input: DealInput): Promise<ActionResult<Deal>> {
  return withSetuUser("updateDeal", async () => {
    const checked = checkDealInput(input);
    if (!checked.ok) return failure(checked.error);
    const current = await db.crmDeal.findUnique({ where: { id: dealId }, select: { stage: true, dealCode: true, contactRole: true } });
    if (!current) return failure("This deal no longer exists.");
    const { stage, value, contactRole, ...rest } = checked.value;
    // Keep the record's BNI tags (member / opportunity / origin); a stage change from this form
    // drops the pipeline sub-stage and On Hold flag, like a move.
    const { tags } = decodeRole(current.contactRole);
    const keep = stage === current.stage ? tags : { kind: tags.kind, origin: tags.origin, hold: false };
    const row = await withCodeRetry(async () =>
      db.crmDeal.update({
        where: { id: dealId },
        data: { ...rest, contactRole: encodeRole(contactRole, keep), value: value ?? null, ...(await stageFields(current, stage)) },
        include: dealInclude,
      })
    );
    revalidateSetu();
    return success(toDeal(row));
  });
}

export async function moveDealAction(dealId: string, stage: DealStage): Promise<ActionResult<Deal>> {
  return withSetuUser("moveDeal", async () => {
    if (!isStage(stage)) return failure("Unknown stage.");
    const current = await db.crmDeal.findUnique({ where: { id: dealId }, select: { stage: true, dealCode: true, contactRole: true } });
    if (!current) return failure("This deal no longer exists.");
    if (current.stage === stage) {
      const deal = await loadDeal(dealId);
      return deal ? success(deal) : failure("This deal no longer exists.");
    }
    // A plain stage move lands in that stage's main column (no sub-stage, not on hold).
    const { role, tags } = decodeRole(current.contactRole);
    const contactRole = encodeRole(role, { kind: tags.kind, origin: tags.origin, hold: false });
    const row = await withCodeRetry(async () =>
      db.crmDeal.update({ where: { id: dealId }, data: { ...(await stageFields(current, stage)), contactRole }, include: dealInclude })
    );
    revalidateSetu();
    return success(toDeal(row));
  });
}

/** Saves the Closed Won details (+ signed documents) and moves the deal to Closed Won. */
export async function closeWonAction(dealId: string, details: Omit<DealWonDetails, "documents">, documents: DealFile[]): Promise<ActionResult<Deal>> {
  return withSetuUser("closeWon", async (me) => {
    const checked = checkWon(details);
    if (!checked.ok) return failure(checked.error);
    const files = checkUploadedFiles(documents);
    if (!files.ok) return failure(files.error);
    const current = await db.crmDeal.findUnique({ where: { id: dealId }, select: { stage: true, dealCode: true } });
    if (!current) return failure("This deal no longer exists.");
    const w = checked.value;
    const stage = await stageFields(current, "CLOSED_WON");
    const keepIds = files.value.filter((f) => f.id).map((f) => f.id as string);

    await db.$transaction([
      db.crmDealWon.upsert({
        where: { dealId },
        create: { dealId, finalValue: w.finalValue, closedDate: dayToDate(w.closedDate), advanceReceived: w.advanceReceived, contractTerm: w.contractTerm, paymentTerms: w.paymentTerms },
        update: { finalValue: w.finalValue, closedDate: dayToDate(w.closedDate), advanceReceived: w.advanceReceived, contractTerm: w.contractTerm, paymentTerms: w.paymentTerms },
      }),
      // Documents removed in the form are dropped; newly uploaded ones (no id yet) are added.
      db.crmFile.deleteMany({ where: { dealId, kind: "CLOSING_DOCUMENT", id: { notIn: keepIds } } }),
      db.crmFile.createMany({
        data: files.value
          .filter((f) => !f.id)
          .map((f) => ({ dealId, kind: "CLOSING_DOCUMENT" as const, name: f.name, size: f.size, url: f.url, uploadedById: me.id })),
      }),
      db.crmDeal.update({ where: { id: dealId }, data: { ...stage, value: w.finalValue, closedAt: dayToDate(w.closedDate) } }),
    ]);
    revalidateSetu();
    const deal = await loadDeal(dealId);
    return deal ? success(deal) : failure("This deal no longer exists.");
  });
}

/** Saves the loss details and moves the deal to Closed Lost; the re-engagement date becomes the due date. */
export async function closeLostAction(dealId: string, details: DealLostDetails): Promise<ActionResult<Deal>> {
  return withSetuUser("closeLost", async () => {
    const checked = checkLost(details);
    if (!checked.ok) return failure(checked.error);
    const current = await db.crmDeal.findUnique({ where: { id: dealId }, select: { stage: true, dealCode: true } });
    if (!current) return failure("This deal no longer exists.");
    const l = checked.value;
    const stage = await stageFields(current, "CLOSED_LOST");
    const fields = {
      lostValue: l.lostValue,
      primaryReason: l.primaryReason,
      secondaryFactor: l.secondaryFactor,
      closedDate: dayToDate(l.closedDate),
      analysis: l.analysis,
      reengageDate: l.reengageDate ? dayToDate(l.reengageDate) : null,
      reengageNote: l.reengageNote,
      keepNurturing: l.keepNurturing,
    };
    await db.$transaction([
      db.crmDealLost.upsert({ where: { dealId }, create: { dealId, ...fields }, update: fields }),
      db.crmDeal.update({
        where: { id: dealId },
        data: {
          ...stage,
          value: l.lostValue,
          remark: l.secondaryFactor ? `${l.primaryReason} — ${l.secondaryFactor}` : l.primaryReason,
          closedAt: dayToDate(l.closedDate),
          dueDate: l.reengageDate ? dayToDate(l.reengageDate) : null,
        },
      }),
    ]);
    revalidateSetu();
    const deal = await loadDeal(dealId);
    return deal ? success(deal) : failure("This deal no longer exists.");
  });
}
