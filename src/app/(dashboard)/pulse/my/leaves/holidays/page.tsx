import { Metadata } from "next";
import { LeaveWorkspace } from "@/features/leave/components/leave-workspace";

export const metadata: Metadata = {
  title: "Holidays | WinOS",
  description: "This year's holidays.",
};

export default function PulseLeaveHolidaysPage() {
  return <LeaveWorkspace initialTab="holidays" />;
}
