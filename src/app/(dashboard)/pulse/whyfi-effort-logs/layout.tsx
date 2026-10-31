import { requirePulseManagerPage } from "@/features/attendance/page-guards";

/** Manager screen: the sidebar only offers it to managers, so members are sent back to WhyFi School. */
export default async function WhyfiEffortLogsLayout({ children }: { children: React.ReactNode }) {
  await requirePulseManagerPage("/pulse/whyfi-learning");
  return children;
}
