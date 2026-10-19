import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { AttendanceWorkspace } from "@/features/attendance/components/attendance-workspace";
import { canManageAttendance } from "@/features/attendance/utils";

export const metadata: Metadata = {
  title: "Team Attendance | WinOS",
  description: "Track team daily attendance, work modes, and availability.",
};

export default async function TeamAttendancePage() {
  const session = await auth();
  return <AttendanceWorkspace canManage={canManageAttendance(session?.user)} currentUserId={session?.user?.id} />;
}
