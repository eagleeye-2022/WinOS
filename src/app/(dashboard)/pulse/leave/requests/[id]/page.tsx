import { Metadata } from "next";
import { LeaveWorkspace } from "@/features/leave/components/leave-workspace";

export const metadata: Metadata = {
  title: "Leave Request Details | WinOS",
  description: "View leave request details, approval flow, and balance.",
};

export default async function PulseLeaveRequestDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <LeaveWorkspace
      initialTab="request-details"
      initialSelectedRequestId={id}
    />
  );
}
