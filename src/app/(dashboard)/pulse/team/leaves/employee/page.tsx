import { Metadata } from "next";
import { TeamLeaveWorkspace } from "@/features/leave/components/team-leave-workspace";
import { requirePulseManagerPage } from "@/features/attendance/page-guards";

export const metadata: Metadata = {
  title: "Team Member Leave | WinOS",
  description: "Each team member's leave summary.",
};

export default async function TeamMemberLeaveListPage() {
  await requirePulseManagerPage();
  return <TeamLeaveWorkspace initialTab="employee-leave" />;
}
