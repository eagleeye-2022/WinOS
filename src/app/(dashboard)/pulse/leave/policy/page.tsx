import { Metadata } from "next";
import { TeamLeaveWorkspace } from "@/features/leave/components/team-leave-workspace";
import { requirePulseManagerPage } from "@/features/attendance/page-guards";

export const metadata: Metadata = {
  title: "Leave Policy & Types | WinOS",
  description: "Configure and manage leave policies and leave types.",
};

export default async function PulseLeavePolicyPage() {
  await requirePulseManagerPage();
  return <TeamLeaveWorkspace initialTab="leave-policy" />;
}
