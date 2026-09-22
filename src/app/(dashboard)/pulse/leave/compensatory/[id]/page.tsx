import { Metadata } from "next";
import { CompensatoryDetailsView } from "@/features/leave/components/compensatory-details-view";
import { INITIAL_COMPENSATORY_REQUESTS } from "@/features/leave/data/mock-leave-data";

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
  const request =
    INITIAL_COMPENSATORY_REQUESTS.find((r) => r.id === id) ||
    INITIAL_COMPENSATORY_REQUESTS[0];

  return <CompensatoryDetailsView request={request} />;
}
