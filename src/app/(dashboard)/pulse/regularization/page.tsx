import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { AttendanceWorkspace } from "@/features/attendance/components/attendance-workspace";
import { canManageAttendance } from "@/features/attendance/utils";

export const metadata: Metadata = {
  title: "Regularization Requests | WinOS",
  description: "Track and submit attendance regularization requests.",
};

export default async function RegularizationPage() {
  const session = await auth();
  return <AttendanceWorkspace canManage={canManageAttendance(session?.user)} currentUserId={session?.user?.id} />;
}
