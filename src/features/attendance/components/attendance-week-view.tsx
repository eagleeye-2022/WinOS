"use client";


import { Building2, LogIn, LogOut, Wifi } from "lucide-react";
import { AttendanceRecord } from "../types";
import { istDateKey } from "../utils";
import { DateTile, TONE_DOT, TONE_SOFT, type PulseTone } from "@/components/pulse/pulse-ui";
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

interface DayLook {
  label: string;
  tone: PulseTone;
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
      return { label: `Half day · ${type}${session}`, tone: "amber" };
    }
    case "ON_LEAVE":
      return {
        label: `${record.leaveInfo?.leaveType || "Leave"}${record.leaveInfo?.status === "PENDING" ? " · Pending" : ""}`,
        tone: "amber",
      };
    case "ACTION_REQUIRED":
      if (!record.actionRequiredType) {
        return { label: record.actionRequiredReason || "Regularization pending", tone: "amber" };
      }
      return record.checkInTime
        ? { label: "Check-out missing", tone: "red" }
        : { label: "Absent", tone: "red" };
    case "WEEKEND":
      return { label: "Weekend", tone: "amber" };
    case "HOLIDAY":
      return { label: record.holidayInfo?.name || "Holiday", tone: "violet" };
    default:
      // resolveDay leaves a working day without a check-in as plain "ABSENT" only for today, days
      // still to come and days before joining — missed past days are ACTION_REQUIRED (above).
      // So none of these is a real absence.
      if (isToday) return { label: "Yet to check-in", tone: "gray" };
      if (record.date > todayKey) return { label: "Upcoming", tone: "gray" };
      return { label: "Before joining", tone: "gray" };
  }
}

/** The day's status as a soft pill (flexible hours: no clock times or durations shown). */
function StatusPill({ look }: { look: DayLook }) {
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-xs font-semibold", TONE_SOFT[look.tone])}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[look.tone])} />
      <span className="truncate">{look.label}</span>
    </span>
  );
}

/** List view: one row per day with its status, work mode and actions (no clock times or hours). */
export function AttendanceWeekView({
  records,
  onSelectDay,
  onCheckIn,
  onCheckOut,
  onRegularize,
  todayKey,
  isPunching = false,
}: AttendanceWeekViewProps) {
  const today = todayKey ?? istDateKey();
  const btn = "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      {/* Column headings */}
      <div className="hidden grid-cols-[120px_minmax(0,1fr)_120px_180px] items-end gap-3 border-b border-border/70 bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
        <span>Date</span>
        <span>Status</span>
        <span>Work mode</span>
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
                "md:grid-cols-[120px_minmax(0,1fr)_120px_180px]",
                isToday && "bg-blue-50/50 shadow-[inset_3px_0_0_#3b82f6] dark:bg-blue-500/10",
                (isWeekend || isHoliday) && !isToday && "bg-muted/20"
              )}
            >
              {/* Date */}
              <div className="flex items-center gap-2.5">
                <DateTile day={dayNum} month={mon} tone={isToday ? "blue" : look.tone} highlighted={isToday} />
                <span className={cn("hidden text-xs font-semibold uppercase md:inline", isToday ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground")}>
                  {record.dayOfWeek}
                </span>
              </div>

              {/* Status (flexible hours: no clock times or durations) */}
              <div className="min-w-0">
                <StatusPill look={look} />
                <p className="mt-1 text-[11px] font-semibold uppercase text-muted-foreground md:hidden">{record.dayOfWeek}</p>
              </div>

              {/* Work mode (desktop) */}
              <div className="hidden text-[13px] md:block">
                {record.checkInTime ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    {record.workMode === "REMOTE" ? <Wifi className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                    {record.workMode === "REMOTE" ? "Remote" : "Office"}
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
