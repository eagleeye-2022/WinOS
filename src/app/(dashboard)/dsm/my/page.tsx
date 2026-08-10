import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import {
  getTodayEntry,
  getYesterdayTasks,
  getYesterdayIncompleteTasks,
  getYesterdayBlockers,
  getWeekEntries,
  getWorkspaceNote,
  getKpiStats,
  getTeamMembers,
} from "@/features/dsm/queries";
import { toIsoDateStr, toUtcDate, formatShortDate } from "@/features/dsm/utils";
import { WorkspaceNotesPanel } from "@/features/dsm/components/workspace-notes-panel";
import { DsmHeader } from "@/features/dsm/components/dsm-header";
import { DsmSelfPanel } from "@/features/dsm/components/dsm-self-panel";

import { getTodayCalendarEvents } from "@/features/calendar";

type Props = {
  searchParams: Promise<{ submitted?: string; w?: string }>;
};

export default async function ManagerMyDsmPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);
  // Self-submission is for managers here; team members already have it at /dsm.
  if (session.user.role !== "MANAGER") redirect(ROUTES.dsm);

  const sp = await searchParams;
  const weekOffset = parseInt(sp.w ?? "0") || 0;
  const justSubmitted = sp.submitted === "1";

  const [todayEntry, yesterdayTasks, yesterdayIncompleteTasks, yesterdayBlockers, weekEntries, workspaceNote, kpiStats, teamMembers, todayCalendarEvents] =
    await Promise.all([
      getTodayEntry(),
      getYesterdayTasks(),
      getYesterdayIncompleteTasks(),
      getYesterdayBlockers(),
      getWeekEntries(weekOffset),
      getWorkspaceNote(),
      getKpiStats(),
      getTeamMembers(),
      getTodayCalendarEvents(),
    ]);

  const todayDateStr = toIsoDateStr(toUtcDate());
  const canEditNote =
    session?.user?.role === "MANAGER" ||
    (workspaceNote != null && workspaceNote.owner.id === session?.user?.id);

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
        <DsmHeader entry={todayEntry} />

        {justSubmitted && (
          <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3">
            <svg className="mt-0.5 h-[18px] w-[18px] shrink-0 text-success" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-success">DSM Submitted for {formatShortDate(toUtcDate())}</p>
              <p className="text-xs text-success">Your Team Focus Has Been Updated for Today.</p>
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
          basePath="/dsm/my"
          todayCalendarEvents={todayCalendarEvents}
        />
      </div>

      <aside className="w-80 shrink-0 overflow-hidden border-l xl:w-96">
        <WorkspaceNotesPanel />
      </aside>
    </div>
  );
}
