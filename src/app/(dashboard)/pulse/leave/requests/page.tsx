import { Metadata } from "next";
import { LeaveWorkspace } from "@/features/leave/components/leave-workspace";

export const metadata: Metadata = {
  title: "Leave Requests | WinOS",
  description: "View and manage leave requests.",
};

export default function PulseLeaveRequestsPage() {
  return <LeaveWorkspace initialTab="requests" />;
}

