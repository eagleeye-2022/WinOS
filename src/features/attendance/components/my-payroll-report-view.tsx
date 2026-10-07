"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Calendar,
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

export function MyPayrollReportView() {
  const [selectedYear, setSelectedYear] = useState("2025");
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
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            My Payroll Report
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Summary of your monthly attendance and payable working days.
          </p>
        </div>

        <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition-colors shadow-xs">
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export Report</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
        </button>
      </div>

      {/* Filter Row */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Year Picker */}
          <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Year {selectedYear}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading payroll history...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No records found for {selectedYear}.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Month */}
                    <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-slate-100">
                      {item.month}
                    </td>

                    {/* Company Working Days */}
                    <td className="py-3.5 px-5 font-semibold text-slate-700 dark:text-slate-300">
                      {item.companyWorkingDays}
                    </td>

                    {/* Expected Payable Days */}
                    <td className="py-3.5 px-5 font-semibold text-slate-800 dark:text-slate-200">
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
                    <td className="py-3.5 px-5 font-semibold text-blue-600 dark:text-blue-400">
                      {item.paidOffs.toFixed(1)}
                    </td>

                    {/* Absent Days */}
                    <td className="py-3.5 px-5 font-semibold text-rose-600 dark:text-rose-400">
                      {item.absentDays.toFixed(1)}
                    </td>

                    {/* Total Days */}
                    <td className="py-3.5 px-5 font-extrabold text-slate-900 dark:text-slate-100">
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
