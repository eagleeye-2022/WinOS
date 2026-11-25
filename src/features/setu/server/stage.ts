// Server-only helpers for stage changes, shared by the deal and BNI actions (not a "use server"
// module, so nothing here is callable from the browser).
import type { DealStage } from "../types";
import { isDealStage, isoDate } from "../utils";
import { dayToDate } from "./data";
import { isUniqueViolation, nextDealCode } from "./guard";

/** Stage change side effects: a DEAL code the first time it reaches Proposal; closedAt for closed stages. */
export async function stageFields(current: { stage: DealStage; dealCode: string | null } | null, stage: DealStage) {
  const fields: { stage: DealStage; dealCode?: string; closedAt?: Date | null } = { stage };
  if (isDealStage(stage) && !current?.dealCode) fields.dealCode = await nextDealCode("DEAL");
  if (!current || current.stage !== stage) {
    fields.closedAt = stage === "CLOSED_WON" || stage === "CLOSED_LOST" ? dayToDate(isoDate(new Date())) : null;
  }
  return fields;
}

/** Runs a write that may assign a new code, retrying if another request took the same number. */
export async function withCodeRetry<T>(write: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await write();
    } catch (err) {
      if (attempt < 4 && isUniqueViolation(err)) continue;
      throw err;
    }
  }
}
