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
    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
      {/* Header with Title and Month Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-base font-bold text-foreground">
          Monthly Summary – {summary.month}
        </h3>

        <div className="relative inline-flex items-center">
          <button className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-input bg-background text-xs font-semibold text-foreground hover:bg-accent transition-colors shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{selectedMonth}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-0.5" />
          </button>
        </div>
      </div>

      {/* 4 Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Working Days */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border/60">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-accent text-primary flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground">
              {summary.totalWorkingDays}
            </div>
            <div className="text-xs font-medium text-muted-foreground mt-0.5">
              Total Working Days
            </div>
          </div>
        </div>

        {/* Present */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border/60">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground">
              {summary.presentDays}
            </div>
            <div className="text-xs font-medium text-muted-foreground mt-0.5">
              Present
            </div>
          </div>
        </div>

        {/* Leaves Taken */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border/60">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground">
              {summary.leavesTaken}
            </div>
            <div className="text-xs font-medium text-muted-foreground mt-0.5">
              Leaves Taken
            </div>
          </div>
        </div>

        {/* Absent */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border/60">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground">
              {summary.absentDays}
            </div>
            <div className="text-xs font-medium text-muted-foreground mt-0.5">
              Absent
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
