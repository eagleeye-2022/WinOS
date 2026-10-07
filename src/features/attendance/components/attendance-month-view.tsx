"use client";

import React from "react";
import {
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  ArrowRightCircle,
  Landmark,
} from "lucide-react";
import { AttendanceRecord } from "../types";
import { cn } from "@/lib/utils";

interface AttendanceMonthViewProps {
  records: Record<string, AttendanceRecord>;
  selectedDate: string; // "2026-08-20"
  onSelectDate: (record: AttendanceRecord) => void;
}

export function AttendanceMonthView({
  records,
  selectedDate,
  onSelectDate,
}: AttendanceMonthViewProps) {
  const daysOfWeek = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  // August 2026 calendar grid:
  // Aug 1, 2026 is Saturday. So trailing days from July: 27, 28, 29, 30, 31 (5 days)
  // Aug 1 - 31 (31 days)
  // Leading days into Sept: 1, 2, 3, 4, 5, 6 (6 days) => Total 42 cells (6 weeks)
  const calendarCells = [
    // Trailing July days
    { day: 27, dateStr: "2026-07-27", isCurrentMonth: false },
    { day: 28, dateStr: "2026-07-28", isCurrentMonth: false },
    { day: 29, dateStr: "2026-07-29", isCurrentMonth: false },
    { day: 30, dateStr: "2026-07-30", isCurrentMonth: false },
    { day: 31, dateStr: "2026-07-31", isCurrentMonth: false },

    // August 1 to 31
    ...Array.from({ length: 31 }, (_, i) => {
      const d = i + 1;
      const dateStr = `2026-08-${d < 10 ? `0${d}` : d}`;
      return { day: d, dateStr, isCurrentMonth: true };
    }),

    // Leading Sept days
    { day: 1, dateStr: "2026-09-01", isCurrentMonth: false },
    { day: 2, dateStr: "2026-09-02", isCurrentMonth: false },
    { day: 3, dateStr: "2026-09-03", isCurrentMonth: false },
    { day: 4, dateStr: "2026-09-04", isCurrentMonth: false },
    { day: 5, dateStr: "2026-09-05", isCurrentMonth: false },
    { day: 6, dateStr: "2026-09-06", isCurrentMonth: false },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Calendar Header Row */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 text-center bg-slate-50/50 dark:bg-slate-800/30">
        {daysOfWeek.map((day) => (
          <div
            key={day}
            className="py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800/60 last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid Cells */}
      <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800">
        {calendarCells.map((cell, idx) => {
          const record = records[cell.dateStr];
          const isSelected = cell.dateStr === selectedDate;
          const isHoliday = record?.status === "HOLIDAY";

          return (
            <div
              key={idx}
              onClick={() => {
                if (record) onSelectDate(record);
              }}
              className={cn(
                "min-h-[105px] p-2.5 transition-colors cursor-pointer flex flex-col justify-between relative",
                cell.isCurrentMonth
                  ? "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  : "bg-slate-50/40 dark:bg-slate-900/30 text-slate-300 dark:text-slate-600",
                isHoliday && "bg-blue-50/40 dark:bg-blue-950/20",
                isSelected &&
                  "ring-2 ring-blue-600 dark:ring-blue-500 ring-inset z-10 rounded-lg"
              )}
            >
              {/* Day Number Header */}
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-xs font-bold",
                    cell.isCurrentMonth
                      ? "text-slate-700 dark:text-slate-200"
                      : "text-slate-300 dark:text-slate-600"
                  )}
                >
                  {cell.day}
                </span>

                {isSelected && (
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                    {cell.day}
                  </span>
                )}
              </div>

              {/* Day Cell Content */}
              {cell.isCurrentMonth && record && (
                <div className="mt-1 space-y-1">
                  {/* Present */}
                  {record.status === "PRESENT" && (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Present</span>
                      </div>
                      {record.workedDuration && (
                        <div className="text-[10px] text-slate-400 pl-4 font-medium">
                          {record.workedDuration}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Half Day */}
                  {record.status === "HALF_DAY_LEAVE" && (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        <span className="w-2.5 h-2.5 rounded-full border border-amber-500 bg-amber-500/30 flex items-center justify-center">
                          <span className="w-1.2 h-2.5 bg-amber-500 rounded-l-full" />
                        </span>
                        <span>Half Day</span>
                      </div>
                      {record.workedDuration && (
                        <div className="text-[10px] text-slate-400 pl-3.5 font-medium">
                          {record.workedDuration}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Early Leave */}
                  {record.status === "EARLY_LEAVE" && (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        <Clock className="w-3 h-3" />
                        <span>Early Leave</span>
                      </div>
                      {record.workedDuration && (
                        <div className="text-[10px] text-slate-400 pl-4 font-medium">
                          {record.workedDuration}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Leave */}
                  {record.status === "ON_LEAVE" && (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        <ArrowRightCircle className="w-3 h-3" />
                        <span>Leave</span>
                      </div>
                      <div className="text-[10px] text-slate-400 pl-4">
                        {record.leaveInfo?.leaveType || "Casual Leave"}
                      </div>
                    </div>
                  )}

                  {/* Action Required */}
                  {record.status === "ACTION_REQUIRED" && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                      <AlertCircle className="w-3 h-3" />
                      <span>Action Required</span>
                    </div>
                  )}

                  {/* Holiday */}
                  {record.status === "HOLIDAY" && (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                        <Calendar className="w-3 h-3" />
                        <span>Holiday</span>
                      </div>
                      <div className="text-[10px] text-blue-500/90 dark:text-blue-300 pl-4 font-medium leading-tight">
                        {record.holidayInfo?.name}
                      </div>
                    </div>
                  )}

                  {/* Weekend */}
                  {record.status === "WEEKEND" && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span>Weekend</span>
                    </div>
                  )}
                </div>
              )}

              {!cell.isCurrentMonth && (
                <div className="flex items-center gap-1 text-[10px] text-slate-300 dark:text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                  <span>Weekend</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Legend */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Present</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Leave / Half Day / Early Leave</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span>Action Required / Absent</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-blue-500" />
          <span>Holiday</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-400" />
          <span>Weekend</span>
        </div>
      </div>
    </div>
  );
}
