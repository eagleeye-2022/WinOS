"use client";

import React, { useEffect, useState } from "react";
import { Building2, Clock, LogIn, LogOut, Wifi } from "lucide-react";
import { AttendanceRecord } from "../types";
import { SHIFT_END, SHIFT_START, istDateKey, parseTime12h } from "../utils";
import { TONE_DOT, TONE_TEXT, type PulseTone } from "@/components/pulse/pulse-ui";
import { cn } from "@/lib/utils";

interface AttendanceWeekViewProps {
  records: AttendanceRecord[];
  onSelectDay: (record: AttendanceRecord) => void;
  onCheckIn?: (record: AttendanceRecord) => void;
  onCheckOut?: (record: AttendanceRecord) => void;
  onRegularize?: (record: AttendanceRecord) => void;
  /** "YYYY-MM-DD" in IST — today's row gets the check-in button. */
  todayKey?: string;
  /** Disables check-in/out while a punch is in flight. */
  isPunching?: boolean;
}

// The timeline spans 7 AM – 9 PM; times outside it are pinned to the edges.
const DAY_START = 7 * 60;
const DAY_END = 21 * 60;
const TICKS = [9, 12, 15, 18]; // hour labels along the axis

function pct(minutes: number): number {
  return Math.min(100, Math.max(0, ((minutes - DAY_START) / (DAY_END - DAY_START)) * 100));
}

function hourLabel(h: number) {
  return `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}`;
}

/** Current IST minutes since midnight, set after mount (so server and client renders agree). */
function useIstMinutes(): number | null {
  const [mins, setMins] = useState<number | null>(null);
  useEffect(() => {
    const read = () => setMins(Math.floor((Date.now() / 60_000 + 330) % 1440));
    read();
    const id = setInterval(read, 60_000);
    return () => clearInterval(id);
  }, []);
  return mins;
}

interface DayLook {
  label: string;
  tone: PulseTone;
  /** No punch to draw: show a full-width line instead (dashed for days off). */
  line?: "solid" | "dashed";
}

function lookFor(record: AttendanceRecord, isToday: boolean, todayKey: string): DayLook {
  switch (record.status) {
    case "WORKING_NOW":
      return { label: record.workMode === "REMOTE" ? "Working remotely" : "Working now", tone: "blue" };
    case "PRESENT":
      return { label: "Present", tone: "green" };
    case "EARLY_LEAVE":
      return { label: "Early leave", tone: "amber" };
    case "HALF_DAY_LEAVE": {
      const type = record.leaveInfo?.leaveType || "Leave";
      const session = record.leaveInfo?.session ? ` (${record.leaveInfo.session})` : "";
      return { label: `Half day · ${type}${session}`, tone: "amber", line: record.checkInTime ? undefined : "solid" };
    }
    case "ON_LEAVE":
      return {
        label: `${record.leaveInfo?.leaveType || "Leave"}${record.leaveInfo?.status === "PENDING" ? " · Pending" : ""}`,
        tone: "amber",
        line: "solid",
      };
    case "ACTION_REQUIRED":
      if (!record.actionRequiredType) {
        return { label: record.actionRequiredReason || "Regularization pending", tone: "amber", line: record.checkInTime ? undefined : "solid" };
      }
      return record.checkInTime
        ? { label: "Check-out missing", tone: "red" }
        : { label: "Absent", tone: "red", line: "solid" };
    case "WEEKEND":
      return { label: "Weekend", tone: "amber", line: "dashed" };
    case "HOLIDAY":
      return { label: record.holidayInfo?.name || "Holiday", tone: "violet", line: "dashed" };
    default:
      // resolveDay leaves a working day without a check-in as plain "ABSENT" only for today, days
      // still to come and days before joining — missed past days are ACTION_REQUIRED (above).
      // So none of these is a real absence.
      if (isToday) return { label: "Yet to check-in", tone: "gray", line: "dashed" };
      if (record.date > todayKey) return { label: "Upcoming", tone: "gray", line: "dashed" };
      return { label: "Before joining", tone: "gray", line: "dashed" };
  }
}

const LINE_COLOR: Record<PulseTone, string> = {
  blue: "border-blue-400",
  green: "border-emerald-400",
  red: "border-rose-400",
  amber: "border-amber-400",
  violet: "border-violet-400",
  gray: "border-border",
};

const BAR_COLOR: Record<PulseTone, string> = {
  blue: "bg-blue-500/80",
  green: "bg-emerald-500/80",
  red: "bg-rose-500/70",
  amber: "bg-amber-500/80",
  violet: "bg-violet-500/80",
  gray: "bg-muted-foreground/40",
};

function Timeline({ record, look, nowMins, isToday }: { record: AttendanceRecord; look: DayLook; nowMins: number | null; isToday: boolean }) {
  const shiftStart = parseTime12h(SHIFT_START);
  const shiftEnd = parseTime12h(SHIFT_END);
  const inMins = parseTime12h(record.checkInTime);
  const outMins =
    parseTime12h(record.checkOutTime) ?? (record.status === "WORKING_NOW" && isToday && nowMins !== null ? nowMins : null);

  return (
    <div className="relative h-9">
      {/* Shift hours, shaded */}
      {shiftStart !== null && shiftEnd !== null && (
        <div
          className="absolute top-1/2 h-5 -translate-y-1/2 rounded bg-muted/70"
          style={{ left: `${pct(shiftStart)}%`, width: `${pct(shiftEnd) - pct(shiftStart)}%` }}
        />
      )}

      {inMins !== null && !look.line ? (
        <>
          <div
            className={cn("absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full", BAR_COLOR[look.tone])}
            style={{ left: `${pct(inMins)}%`, width: `${Math.max(1, pct(outMins ?? inMins) - pct(inMins))}%` }}
          />
          <span
            className={cn("absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card", TONE_DOT[look.tone])}
            style={{ left: `${pct(inMins)}%` }}
          />
          {outMins !== null && (
            <span
              className={cn(
                "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
                record.status === "WORKING_NOW" ? "animate-pulse bg-blue-500" : TONE_DOT[look.tone]
              )}
              style={{ left: `${pct(outMins)}%` }}
            />
          )}
        </>
      ) : (
        <div
          className={cn("absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2", LINE_COLOR[look.tone], look.line === "dashed" && "border-dashed")}
        />
      )}

      {/* Status label sits on the line */}
      <span
        className={cn(
          "absolute left-1/2 top-1/2 max-w-[80%] -translate-x-1/2 -translate-y-1/2 truncate rounded-full border border-border/70 bg-card px-2.5 py-0.5 text-[11px] font-semibold shadow-xs",
          TONE_TEXT[look.tone]
        )}
      >
        {look.label}
      </span>
    </div>
  );
}

/** Zoho-style list view: one row per day with a check-in → check-out timeline. */
export function AttendanceWeekView({
  records,
  onSelectDay,
  onCheckIn,
  onCheckOut,
  onRegularize,
  todayKey,
  isPunching = false,
}: AttendanceWeekViewProps) {
  const nowMins = useIstMinutes();
  const today = todayKey ?? istDateKey();
  const btn = "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {/* Column headings + hour axis */}
      <div className="hidden grid-cols-[88px_92px_minmax(0,1fr)_92px_84px_132px] items-end gap-3 border-b border-border/70 bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
        <span>Date</span>
        <span>Check-in</span>
        <div className="relative h-4">
          {TICKS.map((h) => (
            <span key={h} className="absolute -translate-x-1/2 normal-case" style={{ left: `${pct(h * 60)}%` }}>
              {hourLabel(h)}
            </span>
          ))}
        </div>
        <span>Check-out</span>
        <span>Hours</span>
        <span className="text-right">Action</span>
      </div>

      <ul className="divide-y divide-border/70">
        {records.map((record) => {
          const isToday = record.date === today;
          const look = lookFor(record, isToday, today);
          const isWorkingNow = record.status === "WORKING_NOW";
          const isPresent = record.status === "PRESENT" || record.status === "EARLY_LEAVE";
          const isWeekend = record.status === "WEEKEND";
          const isHoliday = record.status === "HOLIDAY";
          // Weekends/holidays allow a check-in too, so comp-off work gets recorded.
          const canCheckIn = isToday && !record.checkInTime && (record.status === "ABSENT" || isWeekend || isHoliday);
          const canRegularize = record.status === "ACTION_REQUIRED" && Boolean(record.actionRequiredType);
          const [dayNum, mon] = record.formattedDate.split(" ");

          return (
            <li
              key={record.id}
              onClick={() => onSelectDay(record)}
              className={cn(
                "grid cursor-pointer grid-cols-[64px_minmax(0,1fr)] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
                "md:grid-cols-[88px_92px_minmax(0,1fr)_92px_84px_132px]",
                isToday && "bg-blue-50/50 shadow-[inset_3px_0_0_#3b82f6] dark:bg-blue-500/10",
                (isWeekend || isHoliday) && !isToday && "bg-muted/20"
              )}
            >
              {/* Date */}
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md border text-center leading-none",
                    isToday ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500" : "border-border/70 bg-card text-foreground"
                  )}
                >
                  <span className="text-sm font-bold">{dayNum}</span>
                  <span className={cn("mt-0.5 text-[9px] font-semibold uppercase", isToday ? "text-white/80" : "text-muted-foreground")}>
                    {mon?.slice(0, 3)}
                  </span>
                </div>
                <span className={cn("hidden text-xs font-semibold uppercase md:inline", isToday ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground")}>
                  {record.dayOfWeek}
                </span>
              </div>

              {/* Check-in (desktop) */}
              <div className="hidden text-[13px] md:block">
                <p className="font-semibold text-foreground">{record.checkInTime || "--:--"}</p>
                {record.checkInTime && (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    {record.workMode === "REMOTE" ? <Wifi className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                    {record.workMode === "REMOTE" ? "Remote" : "Office"}
                  </p>
                )}
              </div>

              {/* Timeline (+ times and actions stacked on small screens) */}
              <div className="min-w-0">
                <Timeline record={record} look={look} nowMins={nowMins} isToday={isToday} />
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground md:hidden">
                  <span>
                    {record.dayOfWeek} · {record.checkInTime || "--:--"} – {record.checkOutTime || (isWorkingNow ? "Now" : "--:--")}
                  </span>
                  {record.workedDuration && <span className="font-semibold text-foreground">{record.workedDuration}</span>}
                </div>
              </div>

              {/* Check-out (desktop) */}
              <div className="hidden text-[13px] md:block">
                <p className={cn("font-semibold", isWorkingNow ? "text-blue-600 dark:text-blue-400" : "text-foreground")}>
                  {record.checkOutTime || (isWorkingNow ? "Now" : "--:--")}
                </p>
              </div>

              {/* Hours (desktop) */}
              <div className="hidden text-[13px] md:block">
                {record.workedDuration ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {record.workedDuration}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>

              {/* Action */}
              <div className="col-span-2 flex justify-end gap-2 md:col-span-1" onClick={(e) => e.stopPropagation()}>
                {isWorkingNow && onCheckOut && (
                  <button type="button" disabled={isPunching} onClick={() => onCheckOut(record)} className={cn(btn, "bg-rose-600 text-white hover:bg-rose-700")}>
                    <LogOut className="h-3.5 w-3.5" /> Check-out
                  </button>
                )}
                {canCheckIn && onCheckIn && (
                  <button type="button" disabled={isPunching} onClick={() => onCheckIn(record)} className={cn(btn, "bg-emerald-600 text-white hover:bg-emerald-700")}>
                    <LogIn className="h-3.5 w-3.5" /> Check-in
                  </button>
                )}
                {isPresent && isToday && onCheckIn && (
                  <button
                    type="button"
                    disabled={isPunching}
                    onClick={() => onCheckIn(record)}
                    className={cn(btn, "border border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-500/10")}
                  >
                    <LogIn className="h-3.5 w-3.5" /> Check-in again
                  </button>
                )}
                {canRegularize && (
                  <button
                    type="button"
                    onClick={() => onRegularize?.(record)}
                    className={cn(btn, "border border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-500/10")}
                  >
                    Regularize
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
