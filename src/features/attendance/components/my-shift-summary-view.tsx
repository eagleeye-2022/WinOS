"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Calendar,
  ChevronDown,
  Download,
  Building2,
  Home,
  CheckCircle2,
  Minus,
  XCircle,
  ArrowUp,
  ArrowDown,
  Clock,
  Loader2,
} from "lucide-react";
import { ShiftSummaryItem } from "../types";
import { getMyShiftSummaryData } from "../queries/attendance-queries";
import { cn } from "@/lib/utils";

export function MyShiftSummaryView() {
  const [selectedMonth, setSelectedMonth] = useState("August 2026");
  const [workModeFilter, setWorkModeFilter] = useState("All");
  const [items, setItems] = useState<ShiftSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadData = () => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        const data = await getMyShiftSummaryData(7, 2026);
        setItems(data);
      } catch (err) {
        console.error("Failed to load my shift summary:", err);
      } finally {
        setIsLoading(false);
      }
    });
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const filteredItems = items.filter((item) => {
    if (workModeFilter !== "All" && item.workMode !== workModeFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6 w-full select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            My Shift Summary
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track your daily shift timings, overtime, and work mode breakdown.
          </p>
        </div>

        <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition-colors shadow-xs">
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export Summary</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
        </button>
      </div>

      {/* Filter Row */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Month Picker */}
          <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{selectedMonth}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Work Mode Dropdown */}
          <select
            value={workModeFilter}
            onChange={(e) => setWorkModeFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="All">All Modes</option>
            <option value="Office">Office</option>
            <option value="Remote">Remote</option>
            <option value="Weekend">Weekend</option>
          </select>
        </div>
      </div>

      {/* Shifts Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-5">Date</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Attendance Time</th>
                <th className="py-3.5 px-5">Total Hours</th>
                <th className="py-3.5 px-5">Check-in Diff</th>
                <th className="py-3.5 px-5">Check-out Diff</th>
                <th className="py-3.5 px-5">Net Hours</th>
                <th className="py-3.5 px-5">Work Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading shift records...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No records found for this period.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Date */}
                    <td className="py-3.5 px-5 font-semibold text-slate-900 dark:text-slate-100">
                      {item.dateStr}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-5">
                      {item.status === "Present" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-900/60 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Present
                        </span>
                      )}
                      {item.status === "Weekend" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                          <Minus className="w-3 h-3" />
                          Weekend
                        </span>
                      )}
                      {item.status === "Absent" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:border-rose-900/60 dark:text-rose-300">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Absent
                        </span>
                      )}
                    </td>

                    {/* Attendance Time */}
                    <td className="py-3.5 px-5 font-semibold text-slate-800 dark:text-slate-200">
                      {item.attendanceTime || "-"}
                    </td>

                    {/* Total Hours */}
                    <td className="py-3.5 px-5 font-extrabold text-slate-900 dark:text-slate-100">
                      {item.totalHours || "-"}
                    </td>

                    {/* Check-in Diff */}
                    <td className="py-3.5 px-5">
                      {item.checkInDiff ? (
                        <div
                          className={cn(
                            "inline-flex items-center gap-1 font-semibold text-xs",
                            item.checkInDiff.type === "early" && "text-emerald-600 dark:text-emerald-400",
                            item.checkInDiff.type === "late" && "text-rose-600 dark:text-rose-400",
                            item.checkInDiff.type === "on-time" && "text-slate-500"
                          )}
                        >
                          {item.checkInDiff.type === "early" && <ArrowDown className="w-3 h-3" />}
                          {item.checkInDiff.type === "late" && <ArrowUp className="w-3 h-3" />}
                          <span>{item.checkInDiff.label}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Check-out Diff */}
                    <td className="py-3.5 px-5">
                      {item.checkOutDiff ? (
                        <div
                          className={cn(
                            "inline-flex items-center gap-1 font-semibold text-xs",
                            item.checkOutDiff.type === "late" && "text-emerald-600 dark:text-emerald-400",
                            item.checkOutDiff.type === "early" && "text-rose-600 dark:text-rose-400",
                            item.checkOutDiff.type === "on-time" && "text-slate-500"
                          )}
                        >
                          {item.checkOutDiff.type === "late" && <ArrowUp className="w-3 h-3" />}
                          {item.checkOutDiff.type === "early" && <ArrowDown className="w-3 h-3" />}
                          <span>{item.checkOutDiff.label}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Net Hours */}
                    <td className="py-3.5 px-5">
                      {item.netHours ? (
                        <div
                          className={cn(
                            "font-bold text-xs",
                            item.netHours.type === "positive" && "text-emerald-600 dark:text-emerald-400",
                            item.netHours.type === "negative" && "text-rose-600 dark:text-rose-400",
                            item.netHours.type === "neutral" && "text-slate-500"
                          )}
                        >
                          {item.netHours.label}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Work Mode */}
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {item.workMode === "Office" ? (
                          <Building2 className="w-3 h-3 text-slate-500" />
                        ) : item.workMode === "Remote" ? (
                          <Home className="w-3 h-3 text-slate-500" />
                        ) : (
                          <Minus className="w-3 h-3 text-slate-400" />
                        )}
                        <span>{item.workMode}</span>
                      </span>
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
