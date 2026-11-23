import { Metadata } from "next";
import { ComingSoonPage } from "@/features/setu/components/setu-ui";

export const metadata: Metadata = {
  title: "Forecast | Setu | WinOS",
};

// Design not delivered yet.
export default function SetuForecastPage() {
  return <ComingSoonPage title="Forecast" crumbs={[{ label: "Sales" }, { label: "Forecast" }]} />;
}
