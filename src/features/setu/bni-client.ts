"use client";

import { useMemo } from "react";
import {
  addReferralCountAction,
  addTodoAction,
  convertReferralsAction,
  createMemberAction,
  createProspectAction,
  deleteBniNoteAction,
  log121Action,
  logReferralAction,
  setBniStageAction,
  toggleTodoAction,
  updateMemberAction,
  updateProspectAction,
  updateReferralAction,
} from "./actions/bni-actions";
import { applyBniStage, tagsOf, type BniPatch, type BniStage } from "./bni";
import { useSetuStoreApi } from "./provider";
import type { ActionResult } from "./server/guard";

const upsertAll = <T extends { id: string }>(list: T[], items: T[]): T[] => {
  if (!items.length) return list;
  const byId = new Map(items.map((i) => [i.id, i]));
  const kept = list.map((x) => byId.get(x.id) ?? x);
  const fresh = items.filter((i) => !list.some((x) => x.id === i.id));
  return [...fresh, ...kept];
};

/**
 * The BNI actions (121s, referrals, pipeline stages, to-dos) for components. Each awaits the
 * server action, merges the records it wrote into the Setu store and resolves to the patch;
 * it throws an Error with the server's message when refused (use `attempt()` for toasts).
 */
export function useBni() {
  const store = useSetuStoreApi();
  return useMemo(() => {
    const run = async (p: Promise<ActionResult<BniPatch>>): Promise<BniPatch> => {
      const res = await p;
      if (!res.ok) throw new Error(res.error);
      const { deals, notes, meetings, removedNoteIds } = res.data;
      store.setState((s) => ({
        deals: upsertAll(s.deals, deals),
        notes: upsertAll(s.notes, notes).filter((n) => !removedNoteIds.includes(n.id)),
        meetings: upsertAll(s.meetings, meetings),
      }));
      return res.data;
    };
    return {
      createProspect: (...a: Parameters<typeof createProspectAction>) => run(createProspectAction(...a)),
      updateProspect: (...a: Parameters<typeof updateProspectAction>) => run(updateProspectAction(...a)),
      createMember: (...a: Parameters<typeof createMemberAction>) => run(createMemberAction(...a)),
      updateMember: (...a: Parameters<typeof updateMemberAction>) => run(updateMemberAction(...a)),
      log121: (...a: Parameters<typeof log121Action>) => run(log121Action(...a)),
      convertReferrals: (...a: Parameters<typeof convertReferralsAction>) => run(convertReferralsAction(...a)),
      logReferral: (...a: Parameters<typeof logReferralAction>) => run(logReferralAction(...a)),
      addReferralCount: (...a: Parameters<typeof addReferralCountAction>) => run(addReferralCountAction(...a)),
      updateReferral: (...a: Parameters<typeof updateReferralAction>) => run(updateReferralAction(...a)),
      addTodo: (...a: Parameters<typeof addTodoAction>) => run(addTodoAction(...a)),
      toggleTodo: (...a: Parameters<typeof toggleTodoAction>) => run(toggleTodoAction(...a)),
      deleteBniNote: (...a: Parameters<typeof deleteBniNoteAction>) => run(deleteBniNoteAction(...a)),
      /** Optimistic: the card moves at once and moves back if the server refuses. */
      setStage: async (dealId: string, target: BniStage) => {
        const before = store.getState().deals.find((d) => d.id === dealId);
        if (!before) return;
        const next = applyBniStage({ stage: before.stage, tags: tagsOf(before) }, target);
        store.setState((s) => ({ deals: s.deals.map((d) => (d.id === dealId ? { ...d, stage: next.stage, bni: next.tags } : d)) }));
        try {
          await run(setBniStageAction(dealId, target));
        } catch (err) {
          store.setState((s) => ({ deals: s.deals.map((d) => (d.id === dealId ? before : d)) }));
          throw err;
        }
      },
    };
  }, [store]);
}
