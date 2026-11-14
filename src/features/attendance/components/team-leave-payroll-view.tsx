"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Download,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
} from "lucide-react";
import { getTeamLeavePayrollData } from "../queries/attendance-queries";
import { cn } from "@/lib/utils";
import { istDateKey } from "../utils";
import { PeriodNav } from "@/components/shared/period-nav";

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
  const [selectedMonth, setSelectedMonth] = useState(() => istDateKey().slice(0, 7));
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);
  const [records, setRecords] = useState<LeavePayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadData = () => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        const [y, m] = selectedMonth.split("-").map(Number);
        const data = await getTeamLeavePayrollData(m - 1, y);
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
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Team Leave for Payroll
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <PeriodNav modes={["month"]} value={selectedMonth} onChange={setSelectedMonth} />

          {/* Export Button */}
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-input bg-background text-xs font-semibold text-foreground hover:bg-accent shadow-xs transition-colors">
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl bg-card border border-border overflow-visible shadow-xs">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <th className="py-4 px-6">Team Member</th>
                <th className="py-4 px-6 text-center">Total Days</th>
                <th className="py-4 px-6 text-center">Weekend</th>
                <th className="py-4 px-6 text-center">Payable Days</th>
                <th className="py-4 px-6 text-center">Loss of Pay</th>
                <th className="py-4 px-6 text-center">Paid Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading leave payroll data...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
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
                      className="hover:bg-muted/50 transition-colors"
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
                          <span className="font-semibold text-foreground">
                            {rec.name}
                          </span>
                        </div>
                      </td>

                      {/* Total Days */}
                      <td className="py-4 px-6 text-center font-medium text-muted-foreground">
                        {rec.totalDays}
                      </td>

                      {/* Weekend */}
                      <td className="py-4 px-6 text-center font-medium text-muted-foreground">
                        {rec.weekend}
                      </td>

                      {/* Payable Days */}
                      <td className="py-4 px-6 text-center font-semibold text-foreground">
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
                                : "text-foreground"
                            )}
                          >
                            {rec.lossOfPay.toFixed(1)}
                          </span>

                          {hasLop && rec.lossOfPayBreakdown && (
                            <button
                              onClick={(e) => togglePopover(rec.id, e)}
                              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus:outline-none"
                              title="View Loss of Pay Breakdown"
                            >
                              <Info className="w-3.5 h-3.5 text-blue-500 hover:text-foreground" />
                            </button>
                          )}
                        </div>

                        {/* Batch 5 Popover Card */}
                        {isPopoverOpen && rec.lossOfPayBreakdown && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute left-1/2 -translate-x-1/2 top-12 z-50 w-72 p-4 rounded-2xl bg-card border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left"
                          >
                            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border">
                              <span className="text-xs font-bold text-foreground">
                                Loss of Pay Details
                              </span>
                              <span className="text-xs font-bold text-rose-600">
                                {rec.lossOfPay.toFixed(1)} Days
                              </span>
                            </div>

                            <div className="space-y-2 text-xs">
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Unpaid Leave</span>
                                <span className="font-semibold text-foreground">
                                  {rec.lossOfPayBreakdown.unpaidLeave.toFixed(1)} Days
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Half Day Unpaid</span>
                                <span className="font-semibold text-foreground">
                                  {rec.lossOfPayBreakdown.halfDayUnpaid.toFixed(1)} Days
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Late Arrival Penalty</span>
                                <span className="font-semibold text-foreground">
                                  {rec.lossOfPayBreakdown.lateArrival.toFixed(1)} Days
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Paid Days */}
                      <td className="py-4 px-6 text-center font-bold text-foreground">
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-border text-xs text-muted-foreground">
          <div>
            Showing <span className="font-bold text-foreground">{records.length}</span> members
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg border border-input hover:bg-accent disabled:opacity-40">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-bold text-foreground">1</span>
            <button className="p-1.5 rounded-lg border border-input hover:bg-accent disabled:opacity-40">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
