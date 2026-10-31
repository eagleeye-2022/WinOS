import { Metadata } from "next";
import { ROUTES } from "@/constants/routes";
import { AttendanceReportsHub } from "@/features/attendance/components/attendance-reports-hub";
import { requirePulseManagerPage } from "@/features/attendance/page-guards";

export const metadata: Metadata = {
  title: "Team Leave Data for Payroll | WinOS",
  description: "View leave summary that impacts payroll processing.",
};

export default async function TeamLeavePayrollPage() {
  await requirePulseManagerPage(`${ROUTES.pulseReports}?report=my-payroll`);
  return <AttendanceReportsHub initialReport="team-leave-payroll" canManage />;
}
