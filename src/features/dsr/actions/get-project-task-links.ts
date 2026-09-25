"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasModuleAccess } from "@/features/users/actions/module-guard";
import { getDsrProjectTaskLinks, type ProjectLinkSummary } from "../queries";

export interface DsrProjectTaskLinksResult {
  hasProjectsAccess: boolean;
  links: Record<string, ProjectLinkSummary>;
}

/**
 * Thin client-callable wrapper around `getDsrProjectTaskLinks` — same read-only project/task/timer
 * summary the Standup Card and Manager review show, joined onto a DSR's planned tasks by text.
 * `userId`/`date` are only honored for a manager viewing another member's DSR (mirrors the same
 * guard used by `fetchDailyTimeSummaryAction`); otherwise it's always the current session user.
 * `hasProjectsAccess` is returned alongside the links (rather than just an empty object when
 * denied) so callers can distinguish "no PROJECTS access" from "no linked tasks today" and hide
 * the Project/Task ID/Time Tracked columns accordingly.
 */
export async function fetchDsrProjectTaskLinksAction(
  plannedTaskTexts: string[],
  date: string, // "YYYY-MM-DD"
  userId?: string
): Promise<DsrProjectTaskLinksResult> {
  const session = await auth();
  if (!session?.user?.id || plannedTaskTexts.length === 0) return { hasProjectsAccess: true, links: {} };

  const hasProjectsAccess = await hasModuleAccess("PROJECTS");
  if (!hasProjectsAccess) return { hasProjectsAccess: false, links: {} };

  let targetUserId = session.user.id;
  if (userId && userId !== session.user.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viewer = await (db as any).user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (viewer?.role !== "MANAGER") return { hasProjectsAccess: true, links: {} };
    targetUserId = userId;
  }

  const links = await getDsrProjectTaskLinks(targetUserId, new Date(date), plannedTaskTexts);
  return { hasProjectsAccess: true, links };
}
