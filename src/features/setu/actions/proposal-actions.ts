"use server";

import { db } from "@/lib/db";
import type { Deal, DealFile, ProposalVersion } from "../types";
import { checkProposal } from "../validation";
import { loadDeal, loadDealProposals } from "../server/data";
import { checkUploadedFiles } from "../server/files";
import { failure, isUniqueViolation, revalidateSetu, success, withSetuUser, type ActionResult } from "../server/guard";

type DraftPatch = { title: string; value: number; reason: string };

/** Starts the next version as a DRAFT copied from the active one. One draft per deal. */
export async function createProposalDraftAction(dealId: string): Promise<ActionResult<ProposalVersion[]>> {
  return withSetuUser("createDraft", async (me) => {
    const deal = await db.crmDeal.findUnique({ where: { id: dealId }, select: { title: true, value: true } });
    if (!deal) return failure("This deal no longer exists.");
    if (await db.crmProposal.findFirst({ where: { dealId, status: "DRAFT" }, select: { id: true } })) return success(await loadDealProposals(dealId));
    const versions = await db.crmProposal.findMany({ where: { dealId }, orderBy: { version: "desc" }, select: { version: true, status: true, title: true, value: true } });
    const base = versions.find((v) => v.status === "ACTIVE") ?? versions[0];
    try {
      await db.crmProposal.create({
        data: {
          dealId,
          version: (versions[0]?.version ?? 0) + 1,
          title: base?.title ?? deal.title,
          value: base?.value ?? deal.value ?? 0,
          authorId: me.id,
          authorRole: me.title ?? null,
          status: "DRAFT",
        },
      });
    } catch (err) {
      // Someone else started V(n+1) at the same moment — theirs wins.
      if (!isUniqueViolation(err)) throw err;
    }
    revalidateSetu();
    return success(await loadDealProposals(dealId));
  });
}

async function writeDraft(proposalId: string, patch: DraftPatch, attachment: DealFile | null | undefined, uploaderId: string) {
  const checked = checkProposal(patch);
  if (!checked.ok) return { error: checked.error } as const;
  const files = checkUploadedFiles(attachment ? [attachment] : []);
  if (!files.ok) return { error: files.error } as const;
  const draft = await db.crmProposal.findUnique({ where: { id: proposalId }, select: { status: true, dealId: true, version: true } });
  if (!draft || draft.status !== "DRAFT") return { error: "This draft no longer exists." } as const;
  const file = files.value[0];
  await db.$transaction([
    db.crmProposal.update({ where: { id: proposalId }, data: checked.value }),
    // The draft has at most one attachment: keep it, replace it, or remove it.
    db.crmFile.deleteMany({ where: { proposalId, ...(file?.id ? { NOT: { id: file.id } } : {}) } }),
    ...(file && !file.id
      ? [db.crmFile.create({ data: { dealId: draft.dealId, proposalId, kind: "PROPOSAL_ATTACHMENT", name: file.name, size: file.size, url: file.url, uploadedById: uploaderId } })]
      : []),
  ]);
  return { draft, value: checked.value } as const;
}

export async function saveProposalDraftAction(proposalId: string, patch: DraftPatch, attachment?: DealFile | null): Promise<ActionResult<ProposalVersion[]>> {
  return withSetuUser("saveDraft", async (me) => {
    const res = await writeDraft(proposalId, patch, attachment, me.id);
    if ("error" in res) return failure(res.error as string);
    revalidateSetu();
    return success(await loadDealProposals(res.draft.dealId));
  });
}

/** Publishes the draft as the ACTIVE offer, supersedes the previous one and sets the deal value. */
export async function publishProposalAction(
  proposalId: string,
  patch: DraftPatch,
  attachment?: DealFile | null
): Promise<ActionResult<{ proposals: ProposalVersion[]; deal: Deal }>> {
  return withSetuUser("publishProposal", async (me) => {
    const res = await writeDraft(proposalId, patch, attachment, me.id);
    if ("error" in res) return failure(res.error as string);
    const { dealId, version } = res.draft;
    await db.$transaction([
      db.crmProposal.updateMany({ where: { dealId, status: "ACTIVE" }, data: { status: "SUPERSEDED" } }),
      db.crmProposal.update({ where: { id: proposalId }, data: { status: "ACTIVE" } }),
      db.crmDeal.update({ where: { id: dealId }, data: { value: res.value.value, proposalVersion: version } }),
    ]);
    revalidateSetu();
    const deal = await loadDeal(dealId);
    if (!deal) return failure("This deal no longer exists.");
    return success({ proposals: await loadDealProposals(dealId), deal });
  });
}

export async function discardProposalDraftAction(proposalId: string): Promise<ActionResult<ProposalVersion[]>> {
  return withSetuUser("discardDraft", async () => {
    const draft = await db.crmProposal.findUnique({ where: { id: proposalId }, select: { status: true, dealId: true } });
    if (!draft) return failure("This draft no longer exists.");
    if (draft.status !== "DRAFT") return failure("Only drafts can be discarded.");
    await db.crmProposal.delete({ where: { id: proposalId } });
    revalidateSetu();
    return success(await loadDealProposals(draft.dealId));
  });
}
