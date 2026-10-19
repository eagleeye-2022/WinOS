import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { AttendanceWorkspace } from "@/features/attendance/components/attendance-workspace";
import { canManageAttendance } from "@/features/attendance/utils";

export const metadata: Metadata = {
  title: "My Attendance | WinOS",
  description: "Track your daily attendance, regularize missing logs, and view monthly work summary.",
};

export default async function AttendancePage() {
  const session = await auth();
  return <AttendanceWorkspace canManage={canManageAttendance(session?.user)} currentUserId={session?.user?.id} />;
}
