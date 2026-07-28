import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMemberReview } from "@/features/dsm/manager/queries";
import { getSharedWorkspaceNotes, getTeamMembers } from "@/features/dsm/queries";
import { MemberReviewDetail } from "@/features/dsm/manager/components/member-review-detail";
import { WorkspaceNotesPanel } from "@/features/dsm/components/workspace-notes-panel";

type Props = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ w?: string }>;
};

export default async function MemberReviewPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    redirect("/dsm/my");
  }

  const { userId } = await params;
  const sp = await searchParams;
  const weekOffset = parseInt(sp.w ?? "0") || 0;

  const [review, sharedNotesData, teamMembers] = await Promise.all([
    getMemberReview(userId, weekOffset),
    getSharedWorkspaceNotes(userId),
    getTeamMembers(),
  ]);

  if (!review) redirect("/dsm/all");

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
        <MemberReviewDetail review={review} weekOffset={weekOffset} teamMembers={teamMembers} />
      </div>
      <aside className="w-80 shrink-0 overflow-hidden border-l xl:w-96">
        <WorkspaceNotesPanel sharedNotes={sharedNotesData.notes} userRole={session.user.role} />
      </aside>
    </div>
  );
}
