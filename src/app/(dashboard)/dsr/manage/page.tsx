import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { getAllDsrStats, getTeamGroupedDsrSubmissions } from "@/features/dsr/manager/queries";
import { getSharedWorkspaceNotes } from "@/features/dsm/queries";
import { AllDsrClient } from "@/features/dsr/manager/components/all-dsr-client";
import { WorkspaceNotesPanel } from "@/features/dsm/components/workspace-notes-panel";

export default async function AllDsrPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    redirect(ROUTES.dsr);
  }

  const [stats, groups, sharedItems] = await Promise.all([
    getAllDsrStats(),
    getTeamGroupedDsrSubmissions(),
    getSharedWorkspaceNotes(),
  ]);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 min-w-0 overflow-hidden">
        <AllDsrClient stats={stats} groups={groups} />
      </div>
      <aside className="w-115 shrink-0 overflow-hidden border-l xl:w-135">
        <WorkspaceNotesPanel
          sharedNotes={sharedItems?.notes || []}
          userRole={session.user.role}
        />
      </aside>
    </div>
  );
}
