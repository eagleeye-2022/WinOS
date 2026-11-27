"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Building2,
  Home,
  Minus,
  Loader2,
} from "lucide-react";
import { ShiftSummaryItem } from "../types";
import { getTeamShiftSummaryData } from "../queries/attendance-queries";
import { formatShortDate, istDateKey } from "../utils";
import { PersonAvatar } from "./person-avatar";
import { UserName } from "@/components/shared/user-card";
import { PeriodNav } from "@/components/shared/period-nav";

export function TeamShiftSummaryView() {
  const [selectedDate, setSelectedDate] = useState(() => istDateKey());
  const [workModeFilter, setWorkModeFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<ShiftSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadData = () => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        const data = await getTeamShiftSummaryData(selectedDate);
        setItems(data);
      } catch (err) {
        console.error("Failed to load shift summary:", err);
      } finally {
        setIsLoading(false);
      }
    });
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const filteredItems = items.filter((item) => {
    if (
      searchTerm &&
      !item.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !item.designation?.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }
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
            Team Shift Summary
          </h1>
        </div>

      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
        <div className="flex items-center flex-wrap gap-2.5">
          <PeriodNav
            modes={["day"]}
            value={selectedDate}
            label={selectedDate === istDateKey() ? `Today, ${formatShortDate(selectedDate)}` : formatShortDate(selectedDate)}
            onChange={setSelectedDate}
          />

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

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search team member or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-md border border-input bg-zinc-50 dark:bg-zinc-800/80 text-xs text-foreground placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Shift Table */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="py-3.5 px-5">Team Member</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Work Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading shift summary...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-muted-foreground">
                    No records found for this filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    {/* Employee Profile */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <PersonAvatar name={item.employeeName} image={item.avatarUrl} />
                        <div>
                          <div className="font-bold text-foreground">
                            <UserName name={item.employeeName} />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.designation}
                          </div>
                        </div>
                      </div>
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
