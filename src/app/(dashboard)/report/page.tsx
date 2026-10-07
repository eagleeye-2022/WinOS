import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import {
  getCurrentDsrEntry,
  getDsrStandupPrefill,
  getWeeklyDsrHistory,
  getDsrInsights,
  getReportTimeSummary,
} from "@/features/dsr/queries";
import { getOpenReportDateStr, getReportConfig } from "@/features/dsr/reporting";
import { getSharedWorkspaceNotes, getParkedTasks } from "@/features/dsm/queries";
import { DsrPageClient } from "@/features/dsr/components/dsr-page-client";

type Props = {
  searchParams: Promise<{ submitted?: string; w?: string }>;
};

export default async function ReportPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);
  if (session.user.role === "MANAGER") redirect(ROUTES.dsrManage);

  const sp = await searchParams;
  const weekOffset = parseInt(sp.w ?? "0") || 0;
  const justSubmitted = sp.submitted === "1";

  // The report day stays open until the cut-off (6:00 AM next day), so just after midnight this is
  // still yesterday's report.
  const reportConfig = getReportConfig();
  const todayDateStr = getOpenReportDateStr(new Date(), reportConfig.cutoff, reportConfig.cutoffDayOffset);

  const [entry, prefill, weeklyEntries, sharedItems, parkedTasks] = await Promise.all([
    getCurrentDsrEntry(todayDateStr),
    getDsrStandupPrefill(todayDateStr),
    getWeeklyDsrHistory(weekOffset),
    getSharedWorkspaceNotes(),
    getParkedTasks(),
  ]);

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
      sharedNotes={sharedItems?.notes || []}
      userRole={session.user.role}
      memberUserId={session.user.id}
      parkedTasks={parkedTasks}
      reportConfig={reportConfig}
      timeSummary={timeSummary}
      memberName={session.user.name}
    />
  );
}
