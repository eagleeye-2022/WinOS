/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/db";
import { WHYFI_TASK_CODE_PREFIX, nextWhyfiTaskCode } from "./constants";

/**
 * The next WhyFi School task ID ("WIFI<n>") — the running number is shared by every learning
 * list, so it's read across all tasks. Server-only (not a "use server" file, so not callable
 * from the browser).
 */
export async function nextWhyfiTaskCodeFromDb(): Promise<string> {
  const rows: { code: string }[] = await (db as any).projectTask.findMany({
    where: { code: { startsWith: WHYFI_TASK_CODE_PREFIX, mode: "insensitive" } },
    select: { code: true },
  });
  return nextWhyfiTaskCode(rows.map((r) => r.code));
}
