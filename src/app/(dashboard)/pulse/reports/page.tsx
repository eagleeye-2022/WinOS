import { Metadata } from "next";
import { AttendanceReportsHub } from "@/features/attendance/components/attendance-reports-hub";

export const metadata: Metadata = {
  title: "Reports | Pulse | WinOS",
  description: "View shift summaries, team attendance logs, and payroll data.",
};

export default function PulseReportsPage() {
  return <AttendanceReportsHub initialReport="team-shift" />;
}
