import { Metadata } from "next";
import { AttendanceWorkspace } from "@/features/attendance/components/attendance-workspace";

export const metadata: Metadata = {
  title: "Regularization Requests | WinOS",
  description: "Track and submit attendance regularization requests.",
};

export default function RegularizationPage() {
  return <AttendanceWorkspace />;
}
