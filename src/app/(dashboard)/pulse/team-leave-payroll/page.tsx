import { Metadata } from "next";
import { AttendanceReportsHub } from "@/features/attendance/components/attendance-reports-hub";

export const metadata: Metadata = {
  title: "Team Leave Data for Payroll | WinOS",
  description: "View leave summary that impacts payroll processing.",
};

export default function TeamLeavePayrollPage() {
  return <AttendanceReportsHub initialReport="team-leave-payroll" />;
}
