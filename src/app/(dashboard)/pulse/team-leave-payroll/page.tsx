import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { AttendanceReportsHub } from "@/features/attendance/components/attendance-reports-hub";
import { canManageAttendance } from "@/features/attendance/utils";

export const metadata: Metadata = {
  title: "Team Leave Data for Payroll | WinOS",
  description: "View leave summary that impacts payroll processing.",
};

export default async function TeamLeavePayrollPage() {
  const session = await auth();
  const canManage = canManageAttendance(session?.user);
  return <AttendanceReportsHub initialReport={canManage ? "team-leave-payroll" : "my-payroll"} canManage={canManage} />;
}
