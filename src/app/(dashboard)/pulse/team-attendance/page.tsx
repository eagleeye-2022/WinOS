import { Metadata } from "next";
import { AttendanceWorkspace } from "@/features/attendance/components/attendance-workspace";

export const metadata: Metadata = {
  title: "Team Attendance | WinOS",
  description: "Track team daily attendance, work modes, and availability.",
};

export default function TeamAttendancePage() {
  return <AttendanceWorkspace />;
}
