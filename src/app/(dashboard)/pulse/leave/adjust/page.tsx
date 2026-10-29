import { Metadata } from "next";
import { LeaveBalanceAdjustmentView } from "@/features/leave/components/leave-balance-adjustment-view";
import { requirePulseManagerPage } from "@/features/attendance/page-guards";

export const metadata: Metadata = {
  title: "Leave Balance Adjustment | WinOS",
  description: "Adjust leave types for a single employee.",
};

export default async function LeaveAdjustPage() {
  await requirePulseManagerPage();
  return <LeaveBalanceAdjustmentView />;
}
