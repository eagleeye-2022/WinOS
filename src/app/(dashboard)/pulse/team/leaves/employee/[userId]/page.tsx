import { Metadata } from "next";
import { EmployeeLeaveWorkspace } from "@/features/leave/components/employee-leave-workspace";
import { requirePulseManagerPage } from "@/features/attendance/page-guards";

export const metadata: Metadata = {
  title: "Team Member Leave | WinOS",
  description: "One team member's leave summary, requests, balances and policies.",
};

export default async function EmployeeLeavePage({ params }: { params: Promise<{ userId: string }> }) {
  await requirePulseManagerPage();
  const { userId } = await params;
  // Keyed so switching person starts fresh (no stale data from the previous one).
  return <EmployeeLeaveWorkspace key={userId} userId={userId} />;
}
