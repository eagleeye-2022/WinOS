"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Calendar,
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

export function TeamPayrollReportView() {
  const [selectedMonth, setSelectedMonth] = useState("August 2026");
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<TeamPayrollItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadData = () => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        const data = await getTeamPayrollReportData(7, 2026);
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
    <div className="flex flex-col gap-6 w-full select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Team Payroll Report
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Calculated attendance metrics for monthly payroll processing.
          </p>
        </div>

        <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition-colors shadow-xs">
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export Payroll Report</span>
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
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search team member..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Payroll Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading payroll data...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No payroll data found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Employee */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            item.avatarUrl ||
                            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                          }
                          alt={item.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {item.designation}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Company Working Days */}
                    <td className="py-3.5 px-5 font-semibold text-slate-700 dark:text-slate-300">
                      {item.companyWorkingDays}
                    </td>

                    {/* Expected Payable Days */}
                    <td className="py-3.5 px-5 font-semibold text-slate-800 dark:text-slate-200">
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
                    <td className="py-3.5 px-5 font-semibold text-blue-600 dark:text-blue-400">
                      {item.paidOffs}
                    </td>

                    {/* Absent Days */}
                    <td className="py-3.5 px-5 font-semibold text-rose-600 dark:text-rose-400">
                      {item.absentDays}
                    </td>

                    {/* Total Days */}
                    <td className="py-3.5 px-5 font-extrabold text-slate-900 dark:text-slate-100">
                      {item.totalDays}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-800 dark:text-slate-200">{filteredItems.length}</span> members
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
