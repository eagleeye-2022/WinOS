import { Metadata } from "next";
import { LeadsPage } from "@/features/setu/components/lists/leads-page";

export const metadata: Metadata = {
  title: "Leads | Setu | WinOS",
  description: "Leads before a proposal.",
};

export default function SetuLeadsPage() {
  return <LeadsPage />;
}
