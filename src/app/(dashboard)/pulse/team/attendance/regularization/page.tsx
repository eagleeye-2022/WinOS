import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { AttendanceWorkspace } from "@/features/attendance/components/attendance-workspace";
import { requirePulseManagerPage } from "@/features/attendance/page-guards";

export const metadata: Metadata = {
  title: "Team Regularization Requests | WinOS",
  description: "Review your team's attendance regularization requests.",
};

/** Team Attendance › Regularization: only the team's requests (a manager's own are on My Attendance). */
export default async function TeamRegularizationPage() {
  await requirePulseManagerPage(ROUTES.pulseRegularization);
  const session = await auth();
  return <AttendanceWorkspace view="team" canManage initialTab="regularization" currentUserId={session?.user?.id} />;
}
