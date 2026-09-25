import { Metadata } from "next";
import { CreateLeaveTypeWizard } from "@/features/leave/components/create-leave-type-wizard";

export const metadata: Metadata = {
  title: "Create New Leave Type | WinOS",
  description: "Configure a new leave type and set the rules for allocation and application.",
};

export default function CreateLeaveTypePage() {
  return <CreateLeaveTypeWizard />;
}
