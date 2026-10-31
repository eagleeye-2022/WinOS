import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { AttendanceWorkspace } from "@/features/attendance/components/attendance-workspace";
import { requirePulseManagerPage } from "@/features/attendance/page-guards";

export const metadata: Metadata = {
  title: "Team Attendance | WinOS",
  description: "Track team daily attendance, work modes, and availability.",
};

export default async function TeamAttendancePage() {
  await requirePulseManagerPage(ROUTES.pulseAttendance);
  const session = await auth();
  return <AttendanceWorkspace canManage initialTab="team-attendance" currentUserId={session?.user?.id} />;
}
