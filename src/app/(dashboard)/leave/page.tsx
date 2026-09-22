import { Metadata } from "next";
import { LeaveWorkspace } from "@/features/leave/components/leave-workspace";

export const metadata: Metadata = {
  title: "Leave Tracker | WinOS",
  description: "Manage time off, apply for leaves, and track balances.",
};

export default function LeavePage() {
  return <LeaveWorkspace initialTab="overview" />;
}
