"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  ChevronDown,
  Download,
  Building2,
  Home,
  CheckCircle2,
  Minus,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { ShiftSummaryItem } from "../types";
import { getMyShiftSummaryData } from "../queries/attendance-queries";
import { istDateKey } from "../utils";
import { PeriodNav, periodBounds, periodKind } from "@/components/shared/period-nav";

export function MyShiftSummaryView() {
  const [selectedMonth, setSelectedMonth] = useState(() => istDateKey().slice(0, 7));
  const [workModeFilter, setWorkModeFilter] = useState("All");
  const [items, setItems] = useState<ShiftSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadData = () => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        // A month loads as a month; a date or range loads exactly those days.
        let data;
        if (periodKind(selectedMonth) === "month") {
          const [y, m] = selectedMonth.split("-").map(Number);
          data = await getMyShiftSummaryData(m - 1, y);
        } else {
          const { start, end } = periodBounds(selectedMonth);
          data = await getMyShiftSummaryData(undefined, undefined, { from: start, to: end });
        }
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
    <div className="flex w-full flex-col gap-4 select-none">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            My Shift Summary
          </h1>
        </div>

        <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-xs font-semibold hover:bg-accent transition-colors">
          <Download className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Export Summary</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-0.5" />
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
        <div className="flex items-center flex-wrap gap-2.5">
          <PeriodNav modes={["day", "range", "month"]} value={selectedMonth} onChange={setSelectedMonth} />

          {/* Work Mode Dropdown */}
          <select
            value={workModeFilter}
            onChange={(e) => setWorkModeFilter(e.target.value)}
            className="px-3.5 py-2 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="All">All Modes</option>
            <option value="Office">Office</option>
            <option value="Remote">Remote</option>
            <option value="Weekend">Weekend</option>
          </select>
        </div>
      </div>

      {/* Shifts Table */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="py-3.5 px-5">Date</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Work Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading shift records...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-muted-foreground">
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
