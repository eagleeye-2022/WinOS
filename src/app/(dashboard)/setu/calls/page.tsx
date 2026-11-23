import { Metadata } from "next";
import { CallsPage } from "@/features/setu/components/lists/calls-page";

export const metadata: Metadata = {
  title: "Calls | Setu | WinOS",
  description: "Every call logged across leads and deals.",
};

export default function SetuCallsPage() {
  return <CallsPage />;
}
