import { Metadata } from "next";
import { AttendanceWorkspace } from "@/features/attendance/components/attendance-workspace";

export const metadata: Metadata = {
  title: "My Attendance | WinOS",
  description: "Track your daily attendance, regularize missing logs, and view monthly work summary.",
};

export default function AttendancePage() {
  return <AttendanceWorkspace />;
}
