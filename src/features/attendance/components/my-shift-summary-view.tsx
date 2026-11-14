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
import { currentMonthLabel } from "../utils";

export function MyShiftSummaryView() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthLabel);
  const [workModeFilter, setWorkModeFilter] = useState("All");
  const [items, setItems] = useState<ShiftSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadData = () => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        const data = await getMyShiftSummaryData();
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
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            My Shift Summary
          </h1>
        </div>

        <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-xs font-semibold hover:bg-accent transition-colors shadow-xs">
          <Download className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Export Summary</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-0.5" />
        </button>
      </div>

      {/* Filter Row */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Month Picker */}
          <button className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-input bg-background text-xs font-semibold text-foreground shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{selectedMonth}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          {/* Work Mode Dropdown */}
          <select
            value={workModeFilter}
            onChange={(e) => setWorkModeFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="All">All Modes</option>
            <option value="Office">Office</option>
            <option value="Remote">Remote</option>
            <option value="Weekend">Weekend</option>
          </select>
        </div>
      </div>

      {/* Shifts Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground uppercase tracking-wider">
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
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading shift records...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    No records found for this period.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    {/* Date */}
                    <td className="py-3.5 px-5 font-semibold text-foreground">
                      {item.dateStr}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-5">
                      {item.status === "Present" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-900/60 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Present
                        </span>
                      )}
                      {item.status === "Weekend" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400">
                          <Minus className="w-3 h-3" />
                          Weekend
                        </span>
                      )}
                      {item.status === "Absent" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:border-rose-900/60 dark:text-rose-300">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Absent
                        </span>
                      )}
                    </td>

                    {/* Attendance Time */}
                    <td className="py-3.5 px-5 font-semibold text-foreground">
                      {item.attendanceTime || "-"}
                    </td>

                    {/* Total Hours */}
                    <td className="py-3.5 px-5 font-bold text-foreground">
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
                            item.checkInDiff.type === "on-time" && "text-muted-foreground"
                          )}
                        >
                          {item.checkInDiff.type === "early" && <ArrowDown className="w-3 h-3" />}
                          {item.checkInDiff.type === "late" && <ArrowUp className="w-3 h-3" />}
                          <span>{item.checkInDiff.label}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
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
                            item.checkOutDiff.type === "on-time" && "text-muted-foreground"
                          )}
                        >
                          {item.checkOutDiff.type === "late" && <ArrowUp className="w-3 h-3" />}
                          {item.checkOutDiff.type === "early" && <ArrowDown className="w-3 h-3" />}
                          <span>{item.checkOutDiff.label}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
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
                            item.netHours.type === "neutral" && "text-muted-foreground"
                          )}
                        >
                          {item.netHours.label}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Work Mode */}
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {item.workMode === "Office" ? (
                          <Building2 className="w-3 h-3 text-muted-foreground" />
                        ) : item.workMode === "Remote" ? (
                          <Home className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <Minus className="w-3 h-3 text-muted-foreground" />
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
