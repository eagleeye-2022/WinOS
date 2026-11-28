import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { AttendanceWorkspace } from "@/features/attendance/components/attendance-workspace";
import { canManageAttendance } from "@/features/attendance/utils";

export const metadata: Metadata = {
  title: "My Regularization Requests | WinOS",
  description: "Track and submit your attendance regularization requests.",
};

/** My Attendance › Regularization: only the signed-in person's own requests. */
export default async function MyRegularizationPage() {
  const session = await auth();
  return (
    <AttendanceWorkspace
      view="my"
      canManage={canManageAttendance(session?.user)}
      initialTab="regularization"
      currentUserId={session?.user?.id}
    />
  );
}
