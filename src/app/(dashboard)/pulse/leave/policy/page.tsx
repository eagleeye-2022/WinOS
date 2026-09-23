import { Metadata } from "next";
import { TeamLeaveWorkspace } from "@/features/leave/components/team-leave-workspace";

export const metadata: Metadata = {
  title: "Leave Policy & Types | WinOS",
  description: "Configure and manage leave policies and leave types.",
};

export default function PulseLeavePolicyPage() {
  return <TeamLeaveWorkspace initialTab="leave-policy" />;
}

