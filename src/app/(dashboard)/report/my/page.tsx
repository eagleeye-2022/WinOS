import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import {
  getCurrentDsrEntry,
  getDsrStandupPrefill,
  getWeeklyDsrHistory,
  getDsrInsights,
  getTodayDsmStatus,
  getReportTimeSummary,
} from "@/features/dsr/queries";
import { getReportConfig } from "@/features/dsr/reporting";
import { getSharedWorkspaceNotes, getParkedTasks } from "@/features/dsm/queries";
import { toUtcDate } from "@/features/dsr/utils";
import { toIsoDateStr } from "@/features/dsm/utils";
import { DsrPageClient } from "@/features/dsr/components/dsr-page-client";

type Props = {
  searchParams: Promise<{ submitted?: string; w?: string }>;
};

export default async function MyReportPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);
  // Self-submission is for managers here; team members already have it at /report.
  if (session.user.role !== "MANAGER") redirect(ROUTES.dsr);

  const sp = await searchParams;
  const weekOffset = parseInt(sp.w ?? "0") || 0;
  const justSubmitted = sp.submitted === "1";

  const [entry, prefill, weeklyEntries, sharedItems, dsmStatus, parkedTasks] = await Promise.all([
    getCurrentDsrEntry(),
    getDsrStandupPrefill(),
    getWeeklyDsrHistory(weekOffset),
    getSharedWorkspaceNotes(),
    getTodayDsmStatus(),
    getParkedTasks(),
  ]);

  const todayDateStr = toIsoDateStr(toUtcDate());
  const [insights, timeSummary] = await Promise.all([
    getDsrInsights(entry),
    getReportTimeSummary(session.user.id, todayDateStr),
  ]);

  return (
    <DsrPageClient
      entry={entry}
      prefill={prefill}
      weeklyEntries={weeklyEntries}
      insights={insights}
      todayDateStr={todayDateStr}
      weekOffset={weekOffset}
      justSubmitted={justSubmitted}
      basePath={ROUTES.dsrMy}
      sharedNotes={sharedItems?.notes || []}
      userRole={session.user.role}
      dsmReviewed={dsmStatus === "REVIEWED"}
      memberUserId={session.user.id}
      parkedTasks={parkedTasks}
      reportConfig={getReportConfig()}
      timeSummary={timeSummary}
      memberName={session.user.name}
    />
  );
}
