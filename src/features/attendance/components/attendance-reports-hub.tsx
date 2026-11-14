"use client";

import React, { useState } from "react";
import { TeamShiftSummaryView } from "./team-shift-summary-view";
import { MyShiftSummaryView } from "./my-shift-summary-view";
import { TeamPayrollReportView } from "./team-payroll-report-view";
import { MyPayrollReportView } from "./my-payroll-report-view";
import { TeamLeavePayrollView } from "./team-leave-payroll-view";
import { PulsePage, PulseStickyTabs } from "@/components/pulse/pulse-ui";
import { usePulseCrumbs } from "@/components/pulse/pulse-breadcrumbs";

import type { ReportType } from "../types";

interface AttendanceReportsHubProps {
  initialReport?: ReportType;
  /** Team reports are manager-only (the queries enforce this too). */
  canManage?: boolean;
}

const TEAM_REPORTS: ReportType[] = ["team-shift", "team-payroll", "team-leave-payroll"];

export function AttendanceReportsHub({
  initialReport = "team-shift",
  canManage = false,
}: AttendanceReportsHubProps) {
  const [activeReport, setActiveReport] = useState<ReportType>(
    !canManage && TEAM_REPORTS.includes(initialReport) ? "my-shift" : initialReport
  );

  const tabs = [
    ...(canManage ? [{ value: "team-shift" as const, label: "Team Shift Summary" }] : []),
    { value: "my-shift" as const, label: "My Shift Summary" },
    ...(canManage ? [{ value: "team-payroll" as const, label: "Team Payroll Data" }] : []),
    ...(canManage ? [{ value: "team-leave-payroll" as const, label: "Team Leave for Payroll" }] : []),
    { value: "my-payroll" as const, label: "My Payroll Data" },
  ];

  // Breadcrumb step after "Pulse › Reports": the open report.
  const activeLabel = tabs.find((tab) => tab.value === activeReport)?.label;
  usePulseCrumbs(activeLabel ? [{ label: activeLabel }] : []);

  return (
    <PulsePage className="select-none p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[1600px] space-y-4">
        {/* Report type tabs */}
        <PulseStickyTabs
          tabs={tabs.map((tab) => ({
            label: tab.label,
            active: activeReport === tab.value,
            onClick: () => setActiveReport(tab.value),
          }))}
        />

        {/* Report Views */}
        {canManage && activeReport === "team-shift" && <TeamShiftSummaryView />}
        {activeReport === "my-shift" && <MyShiftSummaryView />}
        {canManage && activeReport === "team-payroll" && <TeamPayrollReportView />}
        {canManage && activeReport === "team-leave-payroll" && <TeamLeavePayrollView />}
        {activeReport === "my-payroll" && <MyPayrollReportView />}
      </div>
    </PulsePage>
  );
}
