import { Metadata } from "next";
import { TeamLeaveWorkspace } from "@/features/leave/components/team-leave-workspace";
import { requirePulseManagerPage } from "@/features/attendance/page-guards";

export const metadata: Metadata = {
  title: "Team Leave Management | WinOS",
  description: "Review and take action on team leave and compensatory requests.",
};

export default async function TeamLeavePage() {
  await requirePulseManagerPage();
  return <TeamLeaveWorkspace />;
}
