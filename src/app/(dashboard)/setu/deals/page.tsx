import { Metadata } from "next";
import { DealsPage } from "@/features/setu/components/lists/deals-page";

export const metadata: Metadata = {
  title: "Deals | Setu | WinOS",
  description: "Proposals, negotiations and closed deals.",
};

export default function SetuDealsPage() {
  return <DealsPage />;
}
