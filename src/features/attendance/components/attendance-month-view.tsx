"use client";

import React from "react";
import { AttendanceRecord } from "../types";
import { cn } from "@/lib/utils";
import { addDaysToKey, istDateKey, monthKeys, weekKeysFor } from "../utils";
import { TONE_DOT, TONE_TEXT, type PulseTone } from "@/components/pulse/pulse-ui";

interface AttendanceMonthViewProps {
  records: Record<string, AttendanceRecord>;
  selectedDate: string; // "YYYY-MM-DD"
  onSelectDate: (record: AttendanceRecord) => void;
  monthIndex: number; // 0-based
  year: number;
  /** "YYYY-MM-DD" in IST; defaults to now. */
  todayKey?: string;
}

/** Label + colour for a day cell; null when there's nothing to show (future workday). */
function cellLook(record: AttendanceRecord, isToday: boolean): { label: string; sub?: string; tone: PulseTone } | null {
  switch (record.status) {
    case "WORKING_NOW":
      return { label: "Working", tone: "blue" };
    case "PRESENT":
      return { label: "Present", tone: "green" };
    case "EARLY_LEAVE":
      return { label: "Early leave", tone: "amber" };
    case "HALF_DAY_LEAVE":
      return { label: "Half day", sub: record.leaveInfo?.leaveType, tone: "amber" };
    case "ON_LEAVE":
      return {
        label: record.leaveInfo?.status === "PENDING" ? "Leave (pending)" : "Leave",
        sub: record.leaveInfo?.leaveType,
        tone: "amber",
      };
    case "ACTION_REQUIRED":
      return record.actionRequiredType
        ? { label: record.checkInTime ? "Check-out missing" : "Absent", tone: "red" }
        : { label: "Pending review", tone: "amber" };
    case "HOLIDAY":
      return { label: "Holiday", sub: record.holidayInfo?.name, tone: "violet" };
    case "WEEKEND":
      return { label: "Weekend", tone: "gray" };
    default:
      return isToday ? { label: "Yet to check-in", tone: "gray" } : null;
  }
}

const CELL_TINT: Record<PulseTone, string> = {
  blue: "bg-blue-50/70 dark:bg-blue-500/10",
  green: "bg-emerald-50/70 dark:bg-emerald-500/10",
  red: "bg-rose-50/70 dark:bg-rose-500/10",
  amber: "bg-amber-50/70 dark:bg-amber-500/10",
  violet: "bg-violet-50/70 dark:bg-violet-500/10",
  gray: "bg-muted/40",
};

const BAR: Record<PulseTone, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  red: "bg-rose-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  gray: "bg-muted-foreground/30",
};

const LEGEND: { label: string; tone: PulseTone }[] = [
  { label: "Present", tone: "green" },
  { label: "Working now", tone: "blue" },
  { label: "Leave / Half day / Early leave", tone: "amber" },
  { label: "Absent / Action required", tone: "red" },
  { label: "Holiday", tone: "violet" },
  { label: "Weekend", tone: "gray" },
];

export function AttendanceMonthView({
  records,
  selectedDate,
  onSelectDate,
  monthIndex,
  year,
  todayKey = istDateKey(),
}: AttendanceMonthViewProps) {
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Whole Mon–Sun weeks covering the month; edge days belong to the neighbouring months.
  const keys = monthKeys(monthIndex, year);
  const firstKey = weekKeysFor(keys[0])[0];
  const lastKey = weekKeysFor(keys[keys.length - 1])[6];
  const calendarCells: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];
  for (let k = firstKey; k <= lastKey; k = addDaysToKey(k, 1)) {
    calendarCells.push({ day: Number(k.slice(8)), dateStr: k, isCurrentMonth: keys.includes(k) });
  }

  return (
    // Phones: the month keeps a readable width and scrolls sideways.
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
      {/* Weekday header */}
      <div className="grid min-w-[640px] grid-cols-7 border-b border-border/70 bg-muted/40 text-center">
        {daysOfWeek.map((day) => (
          <div key={day} className="py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid min-w-[640px] grid-cols-7">
        {calendarCells.map((cell, idx) => {
          const record = records[cell.dateStr];
          const isSelected = cell.dateStr === selectedDate;
          const isToday = cell.dateStr === todayKey;
          const look = cell.isCurrentMonth && record ? cellLook(record, isToday) : null;

          return (
            <button
              type="button"
              key={idx}
              onClick={() => record && onSelectDate(record)}
              disabled={!record}
              className={cn(
                "relative flex min-h-[96px] flex-col items-stretch border-b border-r border-border/60 p-2 text-left transition-colors [&:nth-child(7n)]:border-r-0",
                cell.isCurrentMonth ? "hover:bg-muted/50" : "bg-muted/20",
                look && CELL_TINT[look.tone],
                isSelected && "z-10 ring-2 ring-inset ring-blue-500"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  isToday
                    ? "bg-blue-600 text-white dark:bg-blue-500"
                    : cell.isCurrentMonth
                    ? "text-foreground"
                    : "text-muted-foreground/50"
                )}
              >
                {cell.day}
              </span>

              {look && (
                <div className="mt-auto min-w-0 space-y-0.5 pt-1">
                  <p className={cn("flex items-center gap-1 truncate text-[11px] font-semibold", TONE_TEXT[look.tone])}>
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[look.tone], record?.status === "WORKING_NOW" && "animate-pulse")} />
                    {look.label}
                  </p>
                  {look.sub && <p className="truncate pl-2.5 text-[11px] text-muted-foreground">{look.sub}</p>}
                </div>
              )}

              {/* Status strip along the bottom of the cell */}
              {look && <span className={cn("absolute inset-x-0 bottom-0 h-0.5", BAR[look.tone])} />}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/70 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        {LEGEND.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", TONE_DOT[l.tone])} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
