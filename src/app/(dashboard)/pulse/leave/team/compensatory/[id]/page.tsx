import { Metadata } from "next";
import { LeaveWorkspace } from "@/features/leave/components/leave-workspace";

export const metadata: Metadata = {
  title: "Compensatory Request Details | WinOS",
  description: "Review a team member's compensatory request and approval flow.",
};

/** A team member's comp-off request opened by a manager — same view, filed under Team Leave. */
export default async function PulseTeamCompensatoryDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LeaveWorkspace initialTab="compensatory-details" initialSelectedCompRequestId={id} teamView />;
}
