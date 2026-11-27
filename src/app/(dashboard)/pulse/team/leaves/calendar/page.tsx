import { Metadata } from "next";
import { TeamLeaveWorkspace } from "@/features/leave/components/team-leave-workspace";
import { requirePulseManagerPage } from "@/features/attendance/page-guards";

export const metadata: Metadata = {
  title: "Team Leave Calendar | WinOS",
  description: "Who is on leave, and when.",
};

export default async function TeamLeaveCalendarPage() {
  await requirePulseManagerPage();
  return <TeamLeaveWorkspace initialTab="team-calendar" />;
}
