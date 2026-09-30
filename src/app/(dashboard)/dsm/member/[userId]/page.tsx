import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMemberReview } from "@/features/dsm/manager/queries";
import { getSharedWorkspaceNotes, getTeamMembers, getParkedTasks, getCoreDailyTasks } from "@/features/dsm/queries";
import { CoreDailyTasksPanel } from "@/features/dsm/components/core-daily-tasks-panel";
import { MemberReviewDetail } from "@/features/dsm/manager/components/member-review-detail";
import { WorkspaceNotesPanel } from "@/features/dsm/components/workspace-notes-panel";
import { StandupTimeline } from "@/features/dsm/components/standup-timeline";
import { relativeDayLabel, toIsoDateStr, toUtcDate } from "@/features/dsm/utils";

type Props = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ w?: string; date?: string }>;
};

export default async function MemberReviewPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    redirect("/dsm/my");
  }

  const { userId } = await params;
  const sp = await searchParams;
  const weekOffset = parseInt(sp.w ?? "0") || 0;
  const dateParam = sp.date;

  const [review, sharedNotesData, teamMembers, parkedTasks, coreDailyTasks] = await Promise.all([
    getMemberReview(userId, weekOffset),
    getSharedWorkspaceNotes(userId),
    getTeamMembers(),
    getParkedTasks(userId),
    getCoreDailyTasks(userId),
  ]);

  if (!review) redirect("/dsm/all");

  const activeEntry = dateParam
    ? review.entries.find((e) => toIsoDateStr(toUtcDate(e.date)) === dateParam) ?? review.entries.find((e) => relativeDayLabel(e.date) === "Today")
    : review.entries.find((e) => relativeDayLabel(e.date) === "Today");

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MemberReviewDetail
          review={review}
          weekOffset={weekOffset}
          teamMembers={teamMembers}
          selectedDateStr={dateParam}
          currentUserId={session.user.id}
          parkedTasks={parkedTasks}
        />
      </div>
      <aside className="flex h-full min-h-0 w-80 shrink-0 flex-col overflow-y-auto border-l xl:w-96">
        <div className="max-h-[350px] shrink-0 overflow-y-auto border-b">
          <WorkspaceNotesPanel sharedNotes={sharedNotesData.notes} userRole={session.user.role} />
        </div>
        {(coreDailyTasks.length > 0 || activeEntry) && (
          <div className="flex flex-col gap-4 p-4">
            {coreDailyTasks.length > 0 && (
              <CoreDailyTasksPanel
                tasks={coreDailyTasks}
                memberView={{
                  memberId: userId,
                  dateStr: activeEntry ? toIsoDateStr(toUtcDate(activeEntry.date)) : toIsoDateStr(toUtcDate()),
                }}
              />
            )}
            {activeEntry && (
              <StandupTimeline entry={activeEntry} events={activeEntry.timelineEvents} />
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
