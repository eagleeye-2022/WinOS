import { Metadata } from "next";
import { LeaveWorkspace } from "@/features/leave/components/leave-workspace";

export const metadata: Metadata = {
  title: "Compensatory Request | WinOS",
  description: "Request compensatory leave for extra hours worked.",
};

export default function PulseCompensatoryApplyPage() {
  return <LeaveWorkspace initialTab="apply-compensatory" />;
}
