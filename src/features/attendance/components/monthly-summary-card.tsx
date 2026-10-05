"use client";

import React from "react";
import {
  Calendar,
  RotateCcw,
  CalendarCheck,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { MonthlySummary } from "../types";

interface MonthlySummaryCardProps {
  summary: MonthlySummary;
  selectedMonth: string;
  onMonthChange?: (month: string) => void;
}

export function MonthlySummaryCard({
  summary,
  selectedMonth,
  onMonthChange,
}: MonthlySummaryCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
      {/* Header with Title and Month Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
          Monthly Summary – {summary.month}
        </h3>

        <div className="relative inline-flex items-center">
          <button className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{selectedMonth}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>
        </div>
      </div>

      {/* 4 Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Working Days */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {summary.totalWorkingDays}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Total Working Days
            </div>
          </div>
        </div>

        {/* Present */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {summary.presentDays}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Present
            </div>
          </div>
        </div>

        {/* Leaves Taken */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {summary.leavesTaken}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Leaves Taken
            </div>
          </div>
        </div>

        {/* Absent */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {summary.absentDays}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Absent
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
