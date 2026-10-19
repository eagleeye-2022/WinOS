import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { AttendanceReportsHub } from "@/features/attendance/components/attendance-reports-hub";
import { canManageAttendance } from "@/features/attendance/utils";

export const metadata: Metadata = {
  title: "Reports | Pulse | WinOS",
  description: "View shift summaries, team attendance logs, and payroll data.",
};

export default async function PulseReportsPage() {
  const session = await auth();
  const canManage = canManageAttendance(session?.user);
  return <AttendanceReportsHub initialReport={canManage ? "team-shift" : "my-shift"} canManage={canManage} />;
}
