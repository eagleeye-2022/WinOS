import { Metadata } from "next";
import { LeaveWorkspace } from "@/features/leave/components/leave-workspace";

export const metadata: Metadata = {
  title: "Compensatory Off Requests | WinOS",
  description: "View and manage compensatory leave requests.",
};

export default function PulseCompensatoryPage() {
  return <LeaveWorkspace initialTab="compensatory" />;
}

