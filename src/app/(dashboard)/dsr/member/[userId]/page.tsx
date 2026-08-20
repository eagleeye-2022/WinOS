import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { getMemberDsrReview } from "@/features/dsr/manager/queries";
import { getMemberReview } from "@/features/dsm/manager/queries";
import { getMemberWorkspaceNote, getSharedWorkspaceNotes } from "@/features/dsm/queries";
import { DsrMemberReview } from "@/features/dsr/manager/components/dsr-member-review";
import { WorkspaceNotesPanel } from "@/features/dsm/components/workspace-notes-panel";
import { StandupTimeline } from "@/features/dsm/components/standup-timeline";
import { InsightsPanel } from "@/features/dsr/components/insights-panel";
import { getDsrInsights } from "@/features/dsr/queries";
import { relativeDayLabel } from "@/features/dsm/utils";

type Props = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ w?: string; reviewed?: string }>;
};

export default async function DsrMemberPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    redirect(ROUTES.dsr);
  }

  const { userId } = await params;
  const sp = await searchParams;
  const weekOffset = parseInt(sp.w ?? "0") || 0;
  const justReviewed = sp.reviewed === "1";

  const [review, workspaceNote, sharedItems, dsmReview] = await Promise.all([
    getMemberDsrReview(userId, weekOffset),
    getMemberWorkspaceNote(userId),
    getSharedWorkspaceNotes(userId),
    getMemberReview(userId, 0),
  ]);

  if (!review) redirect(ROUTES.dsrManage);

  const insights = await getDsrInsights(review.todayEntry ?? null, userId);
  const dsmTodayEntry = dsmReview?.entries.find((e) => relativeDayLabel(e.date) === "Today");

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DsrMemberReview
          review={review}
          weekOffset={weekOffset}
          showHistory={justReviewed}
        />
      </div>
      <aside className="flex h-full min-h-0 w-80  flex-col overflow-y-auto border-l bg-card xl:w-96">
        <div className=" shrink-0 overflow-y-auto border-b">
          <WorkspaceNotesPanel
            sharedNotes={sharedItems?.notes || []}
            userRole={session?.user?.role}
          />
        </div>
        {dsmTodayEntry && (
          <div className="shrink-0 border-b p-4">
            <h2 className="text-lg font-bold">Standup Timeline</h2>
            <StandupTimeline entry={dsmTodayEntry} events={dsmTodayEntry.timelineEvents} />
            <InsightsPanel
              insights={insights}
              entry={review.todayEntry ?? null}
            />
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto">

        </div>
      </aside>
    </div>
  );
}
