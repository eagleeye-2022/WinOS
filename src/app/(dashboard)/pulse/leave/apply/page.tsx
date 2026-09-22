import { Metadata } from "next";
import { LeaveWorkspace } from "@/features/leave/components/leave-workspace";

export const metadata: Metadata = {
  title: "Apply for Leave | WinOS",
  description: "Apply for full day, half day, or early leave.",
};

export default function PulseLeaveApplyPage() {
  return <LeaveWorkspace initialTab="apply" />;
}
