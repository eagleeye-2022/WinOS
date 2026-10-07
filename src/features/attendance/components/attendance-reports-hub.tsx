"use client";

import React, { useState } from "react";
import {
  Clock,
  User,
  Users,
  Briefcase,
  FileSpreadsheet,
  CalendarCheck,
} from "lucide-react";
import { TeamShiftSummaryView } from "./team-shift-summary-view";
import { MyShiftSummaryView } from "./my-shift-summary-view";
import { TeamPayrollReportView } from "./team-payroll-report-view";
import { MyPayrollReportView } from "./my-payroll-report-view";
import { TeamLeavePayrollView } from "./team-leave-payroll-view";
import { cn } from "@/lib/utils";

type ReportType =
  | "team-shift"
  | "my-shift"
  | "team-payroll"
  | "team-leave-payroll"
  | "my-payroll";

interface AttendanceReportsHubProps {
  initialReport?: ReportType;
}

export function AttendanceReportsHub({
  initialReport = "team-shift",
}: AttendanceReportsHubProps) {
  const [activeReport, setActiveReport] = useState<ReportType>(initialReport);

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-background/50 p-6 select-none">
      <div className="max-w-[1600px] w-full mx-auto space-y-6">
        {/* Top Report Type Nav Tabs */}
        <div className="flex flex-wrap items-center border-b border-slate-200 dark:border-slate-800 gap-6">
          <button
            onClick={() => setActiveReport("team-shift")}
            className={cn(
              "pb-3 text-sm font-bold border-b-2 transition-colors relative flex items-center gap-2",
              activeReport === "team-shift"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
            )}
          >
            <Users className="w-4 h-4" />
            <span>Team Shift Summary</span>
          </button>

          <button
            onClick={() => setActiveReport("my-shift")}
            className={cn(
              "pb-3 text-sm font-bold border-b-2 transition-colors relative flex items-center gap-2",
              activeReport === "my-shift"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
            )}
          >
            <Clock className="w-4 h-4" />
            <span>My Shift Summary</span>
          </button>

          <button
            onClick={() => setActiveReport("team-payroll")}
            className={cn(
              "pb-3 text-sm font-bold border-b-2 transition-colors relative flex items-center gap-2",
              activeReport === "team-payroll"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
            )}
          >
            <Briefcase className="w-4 h-4" />
            <span>Team Payroll Data</span>
          </button>

          <button
            onClick={() => setActiveReport("team-leave-payroll")}
            className={cn(
              "pb-3 text-sm font-bold border-b-2 transition-colors relative flex items-center gap-2",
              activeReport === "team-leave-payroll"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
            )}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Team Leave for Payroll</span>
          </button>

          <button
            onClick={() => setActiveReport("my-payroll")}
            className={cn(
              "pb-3 text-sm font-bold border-b-2 transition-colors relative flex items-center gap-2",
              activeReport === "my-payroll"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
            )}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>My Payroll Data</span>
          </button>
        </div>

        {/* Report Views */}
        {activeReport === "team-shift" && <TeamShiftSummaryView />}
        {activeReport === "my-shift" && <MyShiftSummaryView />}
        {activeReport === "team-payroll" && <TeamPayrollReportView />}
        {activeReport === "team-leave-payroll" && <TeamLeavePayrollView />}
        {activeReport === "my-payroll" && <MyPayrollReportView />}
      </div>
    </div>
  );
}
