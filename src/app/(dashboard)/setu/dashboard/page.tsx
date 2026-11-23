import { Metadata } from "next";
import { DashboardPage } from "@/features/setu/components/lists/dashboard-page";

export const metadata: Metadata = {
  title: "Dashboard | Setu | WinOS",
  description: "Team pipeline, agenda and recent activity.",
};

export default function SetuDashboardPage() {
  return <DashboardPage />;
}

