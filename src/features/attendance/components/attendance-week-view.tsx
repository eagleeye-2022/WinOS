"use client";

import React from "react";
import {
  CheckCircle2,
  Clock,
  Building2,
  Wifi,
  AlertCircle,
  Calendar,
  LogOut,
  Umbrella,
  Landmark,
  ArrowRightCircle,
  AlertTriangle,
} from "lucide-react";
import { AttendanceRecord } from "../types";
import { cn } from "@/lib/utils";

interface AttendanceWeekViewProps {
  records: AttendanceRecord[];
  onSelectDay: (record: AttendanceRecord) => void;
  onCheckOut?: (record: AttendanceRecord) => void;
  onRegularize?: (record: AttendanceRecord) => void;
}

export function AttendanceWeekView({
  records,
  onSelectDay,
  onCheckOut,
  onRegularize,
}: AttendanceWeekViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      {records.map((record) => {
        const isWorkingNow = record.status === "WORKING_NOW";
        const isPresent = record.status === "PRESENT";
        const isOnLeave = record.status === "ON_LEAVE";
        const isHalfDay = record.status === "HALF_DAY_LEAVE";
        const isActionRequired = record.status === "ACTION_REQUIRED";
        const isWeekend = record.status === "WEEKEND";
        const isHoliday = record.status === "HOLIDAY";

        return (
          <div
            key={record.id}
            onClick={() => onSelectDay(record)}
            className={cn(
              "group relative bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer min-h-[380px] shadow-xs hover:shadow-md",
              isWorkingNow && "border-blue-300 dark:border-blue-700/70 ring-1 ring-blue-400/30",
              isHalfDay && "border-amber-200 dark:border-amber-900/50",
              isActionRequired && "border-rose-200 dark:border-rose-900/50",
              isPresent && "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700",
              (isWeekend || isHoliday) && "border-slate-200/70 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/40"
            )}
          >
            {/* Top Date & Day Header */}
            <div>
              <div className="mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  {record.dayOfWeek}
                </span>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {record.formattedDate.split(" ").slice(0, 2).join(" ")}
                </p>
              </div>

              {/* Status Header Badge */}
              <div className="mb-4">
                {isWorkingNow && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    Working Now
                  </span>
                )}

                {isPresent && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Present
                  </span>
                )}

                {isOnLeave && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <ArrowRightCircle className="w-3.5 h-3.5" />
                    On Leave
                  </span>
                )}

                {isHalfDay && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <span className="w-3 h-3 rounded-full border border-amber-500 bg-amber-500/30 flex items-center justify-center">
                      <span className="w-1.5 h-3 bg-amber-500 rounded-l-full" />
                    </span>
                    Half Day Leave
                  </span>
                )}

                {isActionRequired && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Action Required
                  </span>
                )}

                {isWeekend && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                    Weekend
                  </span>
                )}

                {isHoliday && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                    <Landmark className="w-3.5 h-3.5" />
                    Holiday
                  </span>
                )}
              </div>

              {/* Card Body by Status */}
              {/* 1. Working Now / Present */}
              {(isWorkingNow || isPresent) && (
                <div className="space-y-4">
                  {/* Timeline */}
                  <div className="relative pl-5 border-l-2 border-slate-100 dark:border-slate-800 space-y-4 py-1">
                    {/* Check In Dot & Time */}
                    <div className="relative">
                      <span
                        className={cn(
                          "absolute -left-[25px] top-1 w-2 h-2 rounded-full",
                          isWorkingNow ? "bg-blue-500" : "bg-emerald-500"
                        )}
                      />
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {record.checkInTime}
                      </div>
                      <div className="text-[11px] text-slate-400">Check-in</div>
                    </div>

                    {/* Check Out Dot & Time */}
                    <div className="relative">
                      <span
                        className={cn(
                          "absolute -left-[25px] top-1 w-2 h-2 rounded-full",
                          isWorkingNow
                            ? "bg-slate-300 dark:bg-slate-700"
                            : "bg-emerald-500"
                        )}
                      />
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {record.checkOutTime || "--:--"}
                      </div>
                      <div className="text-[11px] text-slate-400">Check-out</div>
                    </div>
                  </div>

                  {/* Mode tag */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {record.workMode === "REMOTE" ? (
                      <>
                        <Wifi className="w-3.5 h-3.5 text-slate-400" />
                        <span>Remote</span>
                      </>
                    ) : (
                      <>
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Office</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* 2. Half Day Leave */}
              {isHalfDay && (
                <div className="space-y-3">
                  {/* Leave Badge Card */}
                  <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/40">
                    <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      {record.leaveInfo?.leaveType || "Sick Leave"}
                    </div>
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-200/70 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200">
                      {record.leaveInfo?.session || "First Half"}
                    </span>
                  </div>

                  {/* Timeline for 2nd half */}
                  <div className="relative pl-5 border-l-2 border-slate-100 dark:border-slate-800 space-y-3 py-1">
                    <div className="relative">
                      <span className="absolute -left-[25px] top-1 w-2 h-2 rounded-full bg-amber-500" />
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {record.checkInTime}
                      </div>
                      <div className="text-[10px] text-slate-400">Check-in</div>
                    </div>

                    <div className="relative">
                      <span className="absolute -left-[25px] top-1 w-2 h-2 rounded-full bg-amber-500" />
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {record.checkOutTime}
                      </div>
                      <div className="text-[10px] text-slate-400">Check-out</div>
                    </div>
                  </div>

                  {/* Mode tag */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Office</span>
                  </div>
                </div>
              )}

              {/* 3. Action Required (e.g. Missing Checkout) */}
              {isActionRequired && (
                <div className="space-y-4">
                  <div className="relative pl-5 border-l-2 border-slate-100 dark:border-slate-800 space-y-4 py-1">
                    <div className="relative">
                      <span className="absolute -left-[25px] top-1 w-2 h-2 rounded-full bg-rose-500" />
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {record.checkInTime || "--:--"}
                      </div>
                      <div className="text-[11px] text-slate-400">Check-in</div>
                    </div>

                    <div className="relative">
                      <span className="absolute -left-[25px] top-1 w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
                      <div className="text-sm font-bold text-slate-400 dark:text-slate-500">
                        --:--
                      </div>
                      <div className="text-[11px] text-slate-400">Check-out</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Check-out missing</span>
                  </div>
                </div>
              )}

              {/* 4. On Leave Center Graphic */}
              {isOnLeave && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-amber-100/80 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {record.leaveInfo?.leaveType || "Casual Leave"}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {record.leaveInfo?.duration || "Full Day"}
                  </p>
                </div>
              )}

              {/* 5. Weekend Center Graphic */}
              {isWeekend && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
                    <Umbrella className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Weekend
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">No working day</p>
                </div>
              )}

              {/* 6. Holiday Center Graphic */}
              {isHoliday && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {record.holidayInfo?.name || "Independence Day"}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {record.holidayInfo?.type || "National Holiday"}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Actions / Duration Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-2">
              {isWorkingNow && (
                <div className="space-y-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCheckOut?.(record);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Check- out</span>
                  </button>
                  <p className="text-[10px] text-slate-400 text-center leading-tight">
                    Working hours will update after check-out.
                  </p>
                </div>
              )}

              {isPresent && record.workedDuration && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{record.workedDuration}</span>
                </div>
              )}

              {isHalfDay && record.workedDuration && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{record.workedDuration}</span>
                </div>
              )}

              {isActionRequired && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRegularize?.(record);
                  }}
                  className="w-full py-1.5 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-xs font-bold transition-colors"
                >
                  Regularize
                </button>
              )}

              {(isOnLeave || isWeekend || isHoliday) && (
                <div className="text-center text-xs font-bold text-slate-400">
                  -
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
