"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  ChevronDown,
  Download,
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { TeamPayrollItem } from "../types";
import { getTeamPayrollReportData } from "../queries/attendance-queries";
import { cn } from "@/lib/utils";
import { istDateKey } from "../utils";
import { PeriodNav } from "@/components/shared/period-nav";
import { PersonAvatar } from "./person-avatar";
import { UserName } from "@/components/shared/user-card";

export function TeamPayrollReportView() {
  const [selectedMonth, setSelectedMonth] = useState(() => istDateKey().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<TeamPayrollItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadData = () => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        const [y, m] = selectedMonth.split("-").map(Number);
        const data = await getTeamPayrollReportData(m - 1, y);
        setItems(data);
      } catch (err) {
        console.error("Failed to load team payroll report:", err);
      } finally {
        setIsLoading(false);
      }
    });
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const filteredItems = items.filter((item) => {
    if (
      searchTerm &&
      !item.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !item.designation.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
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
            Team Payroll Report
          </h1>
        </div>

        <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-xs font-semibold hover:bg-accent transition-colors">
          <Download className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Export Payroll Report</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-0.5" />
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
        <div className="flex items-center flex-wrap gap-2.5">
          <PeriodNav modes={["month"]} value={selectedMonth} onChange={setSelectedMonth} />
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search team member..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-md border border-input bg-zinc-50 dark:bg-zinc-800/80 text-xs text-foreground placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Payroll Table */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="py-3.5 px-5">Team Member</th>
                <th className="py-3.5 px-5">Company Working Days</th>
                <th className="py-3.5 px-5">Expected Payable Days</th>
                <th className="py-3.5 px-5">Present Days</th>
                <th className="py-3.5 px-5">Half Days</th>
                <th className="py-3.5 px-5">Paid Offs</th>
                <th className="py-3.5 px-5">Absent Days</th>
                <th className="py-3.5 px-5">Total Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading payroll data...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    No payroll data found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    {/* Employee */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <PersonAvatar name={item.name} image={item.avatarUrl} />
                        <div>
                          <div className="font-bold text-foreground">
                            <UserName name={item.name} />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.designation}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Company Working Days */}
                    <td className="py-3.5 px-5 font-semibold text-foreground">
                      {item.companyWorkingDays}
                    </td>

                    {/* Expected Payable Days */}
                    <td className="py-3.5 px-5 font-semibold text-foreground">
                      {item.expectedPayableDays}
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
                      {item.paidOffs}
                    </td>

                    {/* Absent Days */}
                    <td className="py-3.5 px-5 font-semibold text-rose-600 dark:text-rose-400">
                      {item.absentDays}
                    </td>

                    {/* Total Days */}
                    <td className="py-3.5 px-5 font-bold text-foreground">
                      {item.totalDays}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
          <div>
            Showing <span className="font-bold text-foreground">{filteredItems.length}</span> members
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
