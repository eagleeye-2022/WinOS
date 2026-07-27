import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { toIsoDateStr, toUtcDate } from "@/features/dsm/utils";
import { getAllDsrStats, getTeamGroupedDsrSubmissions } from "@/features/dsr/manager/queries";
import { getSharedWorkspaceNotes } from "@/features/dsm/queries";
import { AllDsrClient } from "@/features/dsr/manager/components/all-dsr-client";
import { WorkspaceNotesPanel } from "@/features/dsm/components/workspace-notes-panel";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

export default async function AllDsrPage({ searchParams }: Props) {
  const params = await searchParams;
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    redirect(ROUTES.dsr);
  }

  const dateParam = params.date;
  let targetDate: Date | undefined = undefined;
  if (dateParam) {
    const [year, month, day] = dateParam.split("-").map(Number);
    targetDate = new Date(year, month - 1, day);
  }

  const todayStr = toIsoDateStr(toUtcDate());
  const selectedDateStr = dateParam || todayStr;

  const [stats, groups, sharedItems] = await Promise.all([
    getAllDsrStats(targetDate),
    getTeamGroupedDsrSubmissions(targetDate),
    getSharedWorkspaceNotes(),
  ]);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 min-w-0 overflow-hidden">
        <AllDsrClient stats={stats} groups={groups} selectedDateStr={selectedDateStr} />
      </div>
      <aside className="w-80 shrink-0 overflow-hidden border-l xl:w-96">
        <WorkspaceNotesPanel
          sharedNotes={sharedItems?.notes || []}
          userRole={session.user.role}
        />
      </aside>
    </div>
  );
}
