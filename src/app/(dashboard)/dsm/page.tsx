import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { auth } from "@/lib/auth";
import {
  getTodayEntry,
  getYesterdayTasks,
  getWeekEntries,
  getWorkspaceNote,
  getKpiStats,
  getTeamMembers,
} from "@/features/dsm/queries";
import { toIsoDateStr, toUtcDate } from "@/features/dsm/utils";
import { TodaysFocusCard } from "@/features/dsm/components/today-focus-card";
import { SubmitDsmForm } from "@/features/dsm/components/submit-dsm-form";
import { WorkspaceNotesPanel } from "@/features/dsm/components/workspace-notes-panel";
import { DsmHeader } from "@/features/dsm/components/dsm-header";
import { KpiCards } from "@/features/dsm/components/kpi-cards";
import { WeekHistory } from "@/features/dsm/components/week-history";

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

  const [todayEntry, yesterdayTasks, weekEntries, workspaceNote, kpiStats, teamMembers] =
    await Promise.all([
      getTodayEntry(),
      getYesterdayTasks(),
      getWeekEntries(weekOffset),
      getWorkspaceNote(),
      getKpiStats(),
      getTeamMembers(),
    ]);

  // Only the note owner can edit it; team members see the manager's note read-only
  const canEditNote = workspaceNote != null && workspaceNote.owner.id === session?.user?.id;

  const todayDateStr = toIsoDateStr(toUtcDate());

  // Show the submission form when today has no entry or only a draft
  const showForm = !todayEntry || todayEntry.status === "DRAFT";

  return (
    <div className="flex h-full">
      {/* ── Main content column ──────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
        <DsmHeader entry={todayEntry} />

        {/* Success banner after submit */}
        {justSubmitted && (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
            />
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                DSM submitted successfully
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Your team focus has been updated for today.
              </p>
            </div>
          </div>
        )}

        {showForm ? (
          /* ── Submission view ─────────────────────────────────────────────── */
          <>
            <TodaysFocusCard entry={todayEntry} />
            <SubmitDsmForm
              entry={todayEntry}
              yesterdayTasks={yesterdayTasks}
              teamMembers={teamMembers}
              todayDateStr={todayDateStr}
            />
          </>
        ) : (
          /* ── History view ────────────────────────────────────────────────── */
          <>
            <WeekHistory entries={weekEntries} weekOffset={weekOffset} />
            <KpiCards stats={kpiStats} />
          </>
        )}
      </div>

      {/* ── Workspace Notes right panel ───────────────────────────────────────── */}
      <aside className="w-115 shrink-0 overflow-hidden border-l xl:w-135">
        <WorkspaceNotesPanel note={workspaceNote} canEdit={canEditNote} />
      </aside>
    </div>
  );
}
