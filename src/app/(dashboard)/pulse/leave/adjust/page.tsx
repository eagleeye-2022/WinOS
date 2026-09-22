import { Metadata } from "next";
import { LeaveBalanceAdjustmentView } from "@/features/leave/components/leave-balance-adjustment-view";

export const metadata: Metadata = {
  title: "Leave Balance Adjustment | WinOS",
  description: "Adjust leave types for a single employee.",
};

export default function LeaveAdjustPage() {
  return <LeaveBalanceAdjustmentView />;
}
