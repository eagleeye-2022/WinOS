import { Metadata } from "next";
import { SetuDashboard } from "@/features/setu/components/setu-dashboard";

export const metadata: Metadata = {
  title: "Dashboard | Setu | WinOS",
  description: "BNI networking CRM — 121 meetings, referrals and the sales pipeline at a glance.",
};

export default function SetuDashboardPage() {
  return <SetuDashboard />;
}
