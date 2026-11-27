import { Metadata } from "next";
import { TeamLeaveWorkspace } from "@/features/leave/components/team-leave-workspace";
import { requirePulseManagerPage } from "@/features/attendance/page-guards";

export const metadata: Metadata = {
  title: "Holidays | WinOS",
  description: "Manage this year's holidays.",
};

export default async function TeamLeaveHolidaysPage() {
  await requirePulseManagerPage();
  return <TeamLeaveWorkspace initialTab="holidays" />;
}
