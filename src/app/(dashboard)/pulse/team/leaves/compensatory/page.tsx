import { Metadata } from "next";
import { TeamLeaveWorkspace } from "@/features/leave/components/team-leave-workspace";
import { requirePulseManagerPage } from "@/features/attendance/page-guards";

export const metadata: Metadata = {
  title: "Team Compensatory Requests | WinOS",
  description: "Review and take action on team compensatory requests.",
};

export default async function TeamCompensatoryRequestsPage() {
  await requirePulseManagerPage();
  return <TeamLeaveWorkspace initialTab="compensatory-requests" />;
}
