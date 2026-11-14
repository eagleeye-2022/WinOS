"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  ChevronDown,
  Download,
  Building,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { MyMonthlyPayrollItem } from "../types";
import { getMyPayrollReportData } from "../queries/attendance-queries";
import { cn } from "@/lib/utils";
import { istDateKey } from "../utils";
import { PeriodNav } from "@/components/shared/period-nav";

export function MyPayrollReportView() {
  const [selectedYear, setSelectedYear] = useState(() => istDateKey().slice(0, 4));
  const [items, setItems] = useState<MyMonthlyPayrollItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadData = () => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        const data = await getMyPayrollReportData(parseInt(selectedYear, 10));
        setItems(data);
      } catch (err) {
        console.error("Failed to load my payroll report:", err);
      } finally {
        setIsLoading(false);
      }
    });
  };

  useEffect(() => {
    loadData();
  }, [selectedYear]);

  return (
    <div className="flex flex-col gap-6 w-full select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            My Payroll Report
          </h1>
        </div>

        <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-xs font-semibold hover:bg-accent transition-colors shadow-xs">
          <Download className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Export Report</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-0.5" />
        </button>
      </div>

      {/* Filter Row */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center flex-wrap gap-2.5">
          <PeriodNav modes={["year"]} value={selectedYear} onChange={setSelectedYear} />
        </div>
      </div>

      {/* Payroll Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <th className="py-3.5 px-5">Month</th>
                <th className="py-3.5 px-5">Company Working Days</th>
                <th className="py-3.5 px-5">Expected Payable Days</th>
                <th className="py-3.5 px-5">Present Days</th>
                <th className="py-3.5 px-5">Half Days</th>
                <th className="py-3.5 px-5">Paid Offs</th>
                <th className="py-3.5 px-5">Absent Days</th>
                <th className="py-3.5 px-5">Total Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading payroll history...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    No records found for {selectedYear}.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    {/* Month */}
                    <td className="py-3.5 px-5 font-bold text-foreground">
                      {item.month}
                    </td>

                    {/* Company Working Days */}
                    <td className="py-3.5 px-5 font-semibold text-foreground">
                      {item.companyWorkingDays}
                    </td>

                    {/* Expected Payable Days */}
                    <td className="py-3.5 px-5 font-semibold text-foreground">
                      {item.expectedPayableDays.toFixed(1)}
                    </td>

                    {/* Present Days */}
                    <td className="py-3.5 px-5 font-bold text-emerald-600 dark:text-emerald-400">
                      {item.presentDays}
                    </td>

                    {/* Half Days */}
                    <td className="py-3.5 px-5 font-semibold text-amber-600 dark:text-amber-400">
                      {item.halfDays}
                    </td>

                    {/* Paid Offs */}
                    <td className="py-3.5 px-5 font-semibold text-primary">
                      {item.paidOffs.toFixed(1)}
                    </td>

                    {/* Absent Days */}
                    <td className="py-3.5 px-5 font-semibold text-rose-600 dark:text-rose-400">
                      {item.absentDays.toFixed(1)}
                    </td>

                    {/* Total Days */}
                    <td className="py-3.5 px-5 font-bold text-foreground">
                      {item.totalDays.toFixed(1)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
