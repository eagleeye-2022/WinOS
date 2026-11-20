// Server-side facts for the report's submit rules (see reportSubmitBlockers in ./reporting).
// Plain module (not "use server") — called from the report pages and from saveDsr.

import { db } from "@/lib/db";
import { getDayEffort, type DayEffortRow } from "@/features/dsm/queries";
import { reportSubmitBlockers } from "./reporting";

const SUBMITTED_DSM_STATUSES = ["SUBMITTED", "PENDING_REVIEW", "REVIEWED"];

/**
 * What still stops `userId` from submitting the report for `dateStr` (YYYY-MM-DD) — empty when
 * nothing does. Pass the day's effort rows if already loaded, to skip a second query.
 */
export async function getReportSubmitBlockers(
  userId: string,
  dateStr: string,
  effort?: DayEffortRow[]
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const day = new Date(`${dateStr}T00:00:00.000Z`);

  const [dsm, halfDayLeave, rows] = await Promise.all([
    d.standupEntry.findUnique({ where: { userId_date: { userId, date: day } }, select: { status: true } }),
    // Same leave matching as the DSM views: approved or pending, covering the day.
    d.leaveRequest.findFirst({
      where: {
        userId,
        durationType: "HALF_DAY",
        status: { in: ["APPROVED", "PENDING"] },
        fromDate: { lte: day },
        toDate: { gte: day },
      },
      select: { id: true },
    }),
    effort ? Promise.resolve(effort) : getDayEffort(userId, dateStr),
  ]);

  const learningMinutes = rows.filter((r: DayEffortRow) => r.isLearning).reduce((s: number, r: DayEffortRow) => s + r.minutes, 0);
  const projectMinutes = rows.filter((r: DayEffortRow) => !r.isLearning).reduce((s: number, r: DayEffortRow) => s + r.minutes, 0);

  return reportSubmitBlockers({
    dsmSubmitted: SUBMITTED_DSM_STATUSES.includes(dsm?.status),
    isHalfDay: Boolean(halfDayLeave),
    projectMinutes,
    learningMinutes,
  });
}
