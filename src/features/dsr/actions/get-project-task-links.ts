"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDsrProjectTaskLinks, type ProjectLinkSummary } from "../queries";

/**
 * Thin client-callable wrapper around `getDsrProjectTaskLinks` — same read-only project/task/timer
 * summary the Standup Card and Manager review show, joined onto a DSR's planned tasks by text.
 * `userId`/`date` are only honored for a manager viewing another member's DSR (mirrors the same
 * guard used by `fetchDailyTimeSummaryAction`); otherwise it's always the current session user.
 */
export async function fetchDsrProjectTaskLinksAction(
  plannedTaskTexts: string[],
  date: string, // "YYYY-MM-DD"
  userId?: string
): Promise<Record<string, ProjectLinkSummary>> {
  const session = await auth();
  if (!session?.user?.id || plannedTaskTexts.length === 0) return {};

  let targetUserId = session.user.id;
  if (userId && userId !== session.user.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viewer = await (db as any).user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (viewer?.role !== "MANAGER") return {};
    targetUserId = userId;
  }

  return await getDsrProjectTaskLinks(targetUserId, new Date(date), plannedTaskTexts);
}
