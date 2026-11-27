import { Metadata } from "next";
import { LeaveWorkspace } from "@/features/leave/components/leave-workspace";

export const metadata: Metadata = {
  title: "Leave Request Details | WinOS",
  description: "Review a team member's leave request, approval flow, and balance.",
};

/** A team member's leave request opened by a manager — same view, filed under Team Leave. */
export default async function PulseTeamLeaveRequestDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LeaveWorkspace initialTab="request-details" initialSelectedRequestId={id} teamView />;
}
