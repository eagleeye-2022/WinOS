import { Metadata } from "next";
import { ROUTES } from "@/constants/routes";
import { EmployeeAttendanceWorkspace } from "@/features/attendance/components/employee-attendance-workspace";
import { requirePulseManagerPage } from "@/features/attendance/page-guards";

export const metadata: Metadata = {
  title: "Team Member Attendance | WinOS",
  description: "One team member's attendance log and regularization.",
};

export default async function EmployeeAttendancePage({ params }: { params: Promise<{ userId: string }> }) {
  await requirePulseManagerPage(ROUTES.pulseAttendance);
  const { userId } = await params;
  return <EmployeeAttendanceWorkspace key={userId} userId={userId} />;
}
