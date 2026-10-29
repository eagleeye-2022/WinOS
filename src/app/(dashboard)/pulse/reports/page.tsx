import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { AttendanceReportsHub } from "@/features/attendance/components/attendance-reports-hub";
import { REPORT_TYPES, type ReportType } from "@/features/attendance/types";
import { canManageAttendance } from "@/features/attendance/utils";

export const metadata: Metadata = {
  title: "Reports | Pulse | WinOS",
  description: "View shift summaries, team attendance logs, and payroll data.",
};

interface PulseReportsPageProps {
  /** `?report=my-payroll` opens that report (e.g. from the Pulse home LOP card). */
  searchParams: Promise<{ report?: string }>;
}

export default async function PulseReportsPage({ searchParams }: PulseReportsPageProps) {
  const [session, { report }] = await Promise.all([auth(), searchParams]);
  const canManage = canManageAttendance(session?.user);
  const requested = (REPORT_TYPES as readonly string[]).includes(report ?? "") ? (report as ReportType) : null;
  return (
    <AttendanceReportsHub
      initialReport={requested ?? (canManage ? "team-shift" : "my-shift")}
      canManage={canManage}
    />
  );
}
