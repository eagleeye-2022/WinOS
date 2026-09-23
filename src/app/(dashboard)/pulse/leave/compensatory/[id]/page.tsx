import { Metadata } from "next";
import { LeaveWorkspace } from "@/features/leave/components/leave-workspace";

export const metadata: Metadata = {
  title: "Compensatory Request Details | WinOS",
  description: "View compensatory request details and approval flow.",
};

export default async function CompensatoryRequestDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <LeaveWorkspace
      initialTab="compensatory-details"
      initialSelectedCompRequestId={id}
    />
  );
}

