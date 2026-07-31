import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { getMemberDsrReview } from "@/features/dsr/manager/queries";
import { getMemberWorkspaceNote, getSharedWorkspaceNotes } from "@/features/dsm/queries";
import { createDsrOpenedEvent } from "@/features/dsr/manager/actions/review-dsr";
import { DsrMemberReview } from "@/features/dsr/manager/components/dsr-member-review";
import { WorkspaceNotesPanel } from "@/features/dsm/components/workspace-notes-panel";

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

  const [review, workspaceNote, sharedItems] = await Promise.all([
    getMemberDsrReview(userId, weekOffset),
    getMemberWorkspaceNote(userId),
    getSharedWorkspaceNotes(userId),
  ]);

  if (!review) redirect(ROUTES.dsrManage);

  // Create OPENED event when manager first views a submitted/pending entry
  if (
    review.todayEntry &&
    (review.todayEntry.status === "SUBMITTED" || review.todayEntry.status === "PENDING_REVIEW")
  ) {
    await createDsrOpenedEvent(review.todayEntry.id);
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DsrMemberReview
          review={review}
          weekOffset={weekOffset}
          showHistory={justReviewed}
        />
      </div>
      <aside className="w-80 shrink-0 overflow-hidden border-l xl:w-96">
        <WorkspaceNotesPanel
          sharedNotes={sharedItems?.notes || []}
          userRole={session?.user?.role}
        />
      </aside>
    </div>
  );
}
