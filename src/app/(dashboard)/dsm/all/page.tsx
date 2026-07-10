import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getAllDsmStats,
  getTeamDsmGroups,
  getAllTeams,
  getAllUsers,
} from "@/features/dsm/manager/queries";
import { AllDsmClient } from "@/features/dsm/manager/components/all-dsm-client";

import { toIsoDateStr, toUtcDate } from "@/features/dsm/utils";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

export default async function AllDsmPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    redirect("/dsm/my");
  }

  const sp = await searchParams;
  const dateParam = sp.date;

  let filterDate: Date | undefined = undefined;
  if (dateParam) {
    const [year, month, day] = dateParam.split("-").map(Number);
    filterDate = new Date(year, month - 1, day);
  }

  const [stats, groups, teams, allUsers] = await Promise.all([
    getAllDsmStats(filterDate),
    getTeamDsmGroups(filterDate),
    getAllTeams(),
    getAllUsers(),
  ]);

  const todayStr = toIsoDateStr(toUtcDate());
  const selectedDateStr = dateParam || todayStr;

  return (
    <AllDsmClient
      stats={stats}
      groups={groups}
      teams={teams}
      allUsers={allUsers}
      selectedDateStr={selectedDateStr}
    />
  );
}
