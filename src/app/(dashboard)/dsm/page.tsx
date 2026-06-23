import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { auth } from "@/lib/auth";
import {
  getTodayEntry,
  getYesterdayTasks,
  getYesterdayIncompleteTasks,
  getWeekEntries,
  getWorkspaceNote,
  getKpiStats,
  getTeamMembers,
} from "@/features/dsm/queries";
import { toIsoDateStr, toUtcDate, formatShortDate } from "@/features/dsm/utils";
import { WorkspaceNotesPanel } from "@/features/dsm/components/workspace-notes-panel";
import { DsmHeader } from "@/features/dsm/components/dsm-header";
import { DsmSelfPanel } from "@/features/dsm/components/dsm-self-panel";

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

  const [todayEntry, yesterdayTasks, yesterdayIncompleteTasks, weekEntries, workspaceNote, kpiStats, teamMembers] =
    await Promise.all([
      getTodayEntry(),
      getYesterdayTasks(),
      getYesterdayIncompleteTasks(),
      getWeekEntries(weekOffset),
      getWorkspaceNote(),
      getKpiStats(),
      getTeamMembers(),
    ]);

  // Only the note owner can edit it; team members see the manager's note read-only
  const canEditNote = workspaceNote != null && workspaceNote.owner.id === session?.user?.id;

  const today = toUtcDate();
  const todayDateStr = toIsoDateStr(today);

  return (
    <div className="flex h-full">
      {/* ── Main content column ──────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
        <DsmHeader entry={todayEntry} />

        {/* Success banner after submit */}
        {justSubmitted && (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-emerald-600"
            />
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                DSM submitted successfully
              </p>
              <p className="text-xs text-emerald-700">
                Your team focus has been updated for {formatShortDate(today)}.
              </p>
            </div>
          </div>
        )}

        <DsmSelfPanel
          entry={todayEntry}
          yesterdayTasks={yesterdayTasks}
          yesterdayIncompleteTasks={yesterdayIncompleteTasks}
          teamMembers={teamMembers}
          todayDateStr={todayDateStr}
          weekEntries={weekEntries}
          weekOffset={weekOffset}
          kpiStats={kpiStats}
          basePath="/dsm"
        />
      </div>

      {/* ── Workspace Notes right panel ───────────────────────────────────────── */}
      <aside className="w-115 shrink-0 overflow-hidden border-l xl:w-135">
        <WorkspaceNotesPanel note={workspaceNote} canEdit={canEditNote} />
      </aside>
    </div>
  );
}
