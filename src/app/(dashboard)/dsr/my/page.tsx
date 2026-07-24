import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import {
  getCurrentDsrEntry,
  getDsrStandupPrefill,
  getWeeklyDsrHistory,
  getDsrInsights,
} from "@/features/dsr/queries";
import { getSharedWorkspaceNotes } from "@/features/dsm/queries";
import { toUtcDate } from "@/features/dsr/utils";
import { toIsoDateStr } from "@/features/dsm/utils";
import { DsrPageClient } from "@/features/dsr/components/dsr-page-client";

type Props = {
  searchParams: Promise<{ submitted?: string; w?: string }>;
};

export default async function MyDsrPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);
  // Self-submission is for managers here; team members already have it at /dsr.
  if (session.user.role !== "MANAGER") redirect(ROUTES.dsr);

  const sp = await searchParams;
  const weekOffset = parseInt(sp.w ?? "0") || 0;
  const justSubmitted = sp.submitted === "1";

  const [entry, prefill, weeklyEntries, sharedItems] = await Promise.all([
    getCurrentDsrEntry(),
    getDsrStandupPrefill(),
    getWeeklyDsrHistory(weekOffset),
    getSharedWorkspaceNotes(),
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
      basePath={ROUTES.dsrMy}
      sharedNotes={sharedItems?.notes || []}
      userRole={session.user.role}
    />
  );
}
