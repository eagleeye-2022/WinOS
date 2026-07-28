import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import {
  getCurrentDsrEntry,
  getDsrStandupPrefill,
  getWeeklyDsrHistory,
  getDsrInsights,
  getTodayDsmStatus,
} from "@/features/dsr/queries";
import { getSharedWorkspaceNotes } from "@/features/dsm/queries";
import { toUtcDate } from "@/features/dsr/utils";
import { toIsoDateStr } from "@/features/dsm/utils";
import { DsrPageClient } from "@/features/dsr/components/dsr-page-client";

type Props = {
  searchParams: Promise<{ submitted?: string; w?: string }>;
};

export default async function DsrPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);
  if (session.user.role === "MANAGER") redirect(ROUTES.dsrManage);

  const sp = await searchParams;
  const weekOffset = parseInt(sp.w ?? "0") || 0;
  const justSubmitted = sp.submitted === "1";

  const [entry, prefill, weeklyEntries, sharedItems, dsmStatus] = await Promise.all([
    getCurrentDsrEntry(),
    getDsrStandupPrefill(),
    getWeeklyDsrHistory(weekOffset),
    getSharedWorkspaceNotes(),
    getTodayDsmStatus(),
  ]);

  const insights = await getDsrInsights(entry);
  const todayDateStr = toIsoDateStr(toUtcDate());

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
      dsmReviewed={dsmStatus === "REVIEWED"}
    />
  );
}
