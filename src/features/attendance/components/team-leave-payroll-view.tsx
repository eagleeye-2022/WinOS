"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Calendar,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
} from "lucide-react";
import { getTeamLeavePayrollData } from "../queries/attendance-queries";
import { cn } from "@/lib/utils";

interface LeavePayrollRecord {
  id: string;
  name: string;
  avatarGradient?: string;
  totalDays: number;
  weekend: number;
  payableDays: number;
  lossOfPay: number;
  paidDays: number;
  lossOfPayBreakdown?: {
    unpaidLeave: number;
    halfDayUnpaid: number;
    lateArrival: number;
  };
}

export function TeamLeavePayrollView() {
  const [selectedMonth, setSelectedMonth] = useState("August 2026");
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);
  const [records, setRecords] = useState<LeavePayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadData = () => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        const data = await getTeamLeavePayrollData(7, 2026);
        setRecords(data);
      } catch (err) {
        console.error("Failed to load team leave payroll data:", err);
      } finally {
        setIsLoading(false);
      }
    });
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const togglePopover = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePopoverId(activePopoverId === id ? null : id);
  };

  return (
    <div
      onClick={() => setActivePopoverId(null)}
      className="flex flex-col gap-6 w-full select-none max-w-[1600px] mx-auto p-6"
    >
      {/* Header with Title and Month Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Team Leave for Payroll
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Overview of total days, weekends, payable days, and loss of pay details for payroll calculation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month Selector Button */}
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{selectedMonth}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Export Button */}
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs transition-colors">
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-visible shadow-xs">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-6">Employee</th>
                <th className="py-4 px-6 text-center">Total Days</th>
                <th className="py-4 px-6 text-center">Weekend</th>
                <th className="py-4 px-6 text-center">Payable Days</th>
                <th className="py-4 px-6 text-center">Loss of Pay</th>
                <th className="py-4 px-6 text-center">Paid Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading leave payroll data...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No records found.
                  </td>
                </tr>
              ) : (
                records.map((rec) => {
                  const hasLop = rec.lossOfPay > 0;
                  const isPopoverOpen = activePopoverId === rec.id;

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Employee Cell */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-linear-to-tr",
                              rec.avatarGradient || "from-blue-500 to-indigo-600"
                            )}
                          >
                            {rec.name.charAt(0)}
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {rec.name}
                          </span>
                        </div>
                      </td>

                      {/* Total Days */}
                      <td className="py-4 px-6 text-center font-medium text-slate-600 dark:text-slate-300">
                        {rec.totalDays}
                      </td>

                      {/* Weekend */}
                      <td className="py-4 px-6 text-center font-medium text-slate-600 dark:text-slate-300">
                        {rec.weekend}
                      </td>

                      {/* Payable Days */}
                      <td className="py-4 px-6 text-center font-semibold text-slate-800 dark:text-slate-200">
                        {rec.payableDays}
                      </td>

                      {/* Loss of Pay with Popover Trigger */}
                      <td className="py-4 px-6 text-center relative">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <span
                            className={cn(
                              "font-bold",
                              hasLop
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-slate-700 dark:text-slate-300"
                            )}
                          >
                            {rec.lossOfPay.toFixed(1)}
                          </span>

                          {hasLop && rec.lossOfPayBreakdown && (
                            <button
                              onClick={(e) => togglePopover(rec.id, e)}
                              className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
                              title="View Loss of Pay Breakdown"
                            >
                              <Info className="w-3.5 h-3.5 text-blue-500 hover:text-blue-600" />
                            </button>
                          )}
                        </div>

                        {/* Batch 5 Popover Card */}
                        {isPopoverOpen && rec.lossOfPayBreakdown && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute left-1/2 -translate-x-1/2 top-12 z-50 w-72 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left"
                          >
                            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                Loss of Pay Details
                              </span>
                              <span className="text-xs font-extrabold text-rose-600">
                                {rec.lossOfPay.toFixed(1)} Days
                              </span>
                            </div>

                            <div className="space-y-2 text-xs">
                              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                <span>Unpaid Leave</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {rec.lossOfPayBreakdown.unpaidLeave.toFixed(1)} Days
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                <span>Half Day Unpaid</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {rec.lossOfPayBreakdown.halfDayUnpaid.toFixed(1)} Days
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                <span>Late Arrival Penalty</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {rec.lossOfPayBreakdown.lateArrival.toFixed(1)} Days
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Paid Days */}
                      <td className="py-4 px-6 text-center font-extrabold text-slate-900 dark:text-slate-100">
                        {rec.paidDays.toFixed(1)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-800 dark:text-slate-200">{records.length}</span> members
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 disabled:opacity-40">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-bold text-slate-800 dark:text-slate-200">1</span>
            <button className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 disabled:opacity-40">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
