import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { auth } from "@/lib/auth";
import {
  getTodayEntry,
  getYesterdayTasks,
  getYesterdayIncompleteTasks,
  getYesterdayBlockers,
  getWeekEntries,
  getKpiStats,
  getTeamMembers,
  getSharedWorkspaceNotes,
} from "@/features/dsm/queries";
import { toIsoDateStr, toUtcDate, formatShortDate } from "@/features/dsm/utils";
import { WorkspaceNotesPanel } from "@/features/dsm/components/workspace-notes-panel";
import { DsmHeader } from "@/features/dsm/components/dsm-header";
import { DsmSelfPanel } from "@/features/dsm/components/dsm-self-panel";

import { getTodayCalendarEvents } from "@/features/calendar";

type Props = {
  searchParams: Promise<{ submitted?: string; w?: string }>;
};

export default async function DSMPage({ searchParams }: Props) {
  const sp = await searchParams;
  const weekOffset = parseInt(sp.w ?? "0") || 0;
  const justSubmitted = sp.submitted === "1";

  const session = await auth();

  // Managers have their own dedicated pages — redirect them out of the member DSM flow
  if (session?.user?.role === "MANAGER") redirect("/dsm/all");

  const [todayEntry, yesterdayTasks, yesterdayIncompleteTasks, yesterdayBlockers, weekEntries, kpiStats, teamMembers, sharedItems, todayCalendarEvents] =
    await Promise.all([
      getTodayEntry(),
      getYesterdayTasks(),
      getYesterdayIncompleteTasks(),
      getYesterdayBlockers(),
      getWeekEntries(weekOffset),
      getKpiStats(weekOffset),
      getTeamMembers(),
      getSharedWorkspaceNotes(),
      getTodayCalendarEvents(),
    ]);

  const today = toUtcDate();
  const todayDateStr = toIsoDateStr(today);

  return (
    <div className="dsm-scope flex h-full bg-background text-foreground">
      {/* ── Main content column ──────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
        <DsmHeader entry={todayEntry} />

        {/* Success banner after submit */}
        {justSubmitted && (
          <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-success"
            />
            <div>
              <p className="text-sm font-semibold text-success">
                DSM Submitted Successfully
              </p>
              <p className="text-xs text-success">
                Your Team Focus Has Been Updated for {formatShortDate(today)}.
              </p>
            </div>
          </div>
        )}

        <DsmSelfPanel
          entry={todayEntry}
          yesterdayTasks={yesterdayTasks}
          yesterdayIncompleteTasks={yesterdayIncompleteTasks}
          yesterdayBlockers={yesterdayBlockers}
          teamMembers={teamMembers}
          todayDateStr={todayDateStr}
          weekEntries={weekEntries}
          weekOffset={weekOffset}
          kpiStats={kpiStats}
          basePath="/dsm"
          todayCalendarEvents={todayCalendarEvents}
        />
      </div>

      {/* ── Workspace Notes right panel ───────────────────────────────────────── */}
      <aside className="w-80 shrink-0 overflow-hidden border-l xl:w-96">
        <WorkspaceNotesPanel
          sharedNotes={sharedItems?.notes || []}
          userRole={session?.user?.role}
        />
      </aside>
    </div>
  );
}
