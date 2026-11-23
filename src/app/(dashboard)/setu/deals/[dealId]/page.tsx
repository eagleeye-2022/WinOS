import { Metadata } from "next";
import { DealDetail } from "@/features/setu/components/deal/deal-detail";

export const metadata: Metadata = {
  title: "Deal | Setu | WinOS",
};

export default async function SetuDealPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  return <DealDetail dealId={dealId} />;
}
