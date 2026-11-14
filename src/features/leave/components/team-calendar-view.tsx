"use client";

import { UserAvatar } from "@/components/shared/user-avatar";
import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  Calendar as CalendarIcon,
  Users,
  Clock,
  Sparkles,
  CheckCircle2,
  CalendarDays,
  Loader2,
  Info,
  CalendarCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PeriodNav } from "@/components/shared/period-nav";
import { cn } from "@/lib/utils";
import { getTeamCalendarEventsAction } from "../queries/leave-queries";

interface LeaveCalendarItem {
  id: string;
  employeeName: string;
  employeeId: string;
  avatarText: string;
  avatarUrl?: string;
  role: string;
  department: string;
  leaveType: string;
  leaveTypeCode: string;
  leaveTypeIcon?: string;
  leaveTypeColor?: string;
  status: string;
  duration: string;
  durationDays: number;
  durationType: string;
  fromDateStr: string;
  toDateStr: string;
  dateRangeDisplay: string;
  reason: string;
  isHalfDay: boolean;
  halfDaySession?: string;
  fromTime?: string;
  toTime?: string;
}

interface HolidayCalendarItem {
  id: string;
  name: string;
  type: "PUBLIC" | "OPTIONAL" | "COMPANY_SPECIAL";
  dayOfWeek: string;
  description?: string;
}

export function TeamCalendarView() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [isPending, startTransition] = useTransition();

  const [leavesByDate, setLeavesByDate] = useState<Record<string, LeaveCalendarItem[]>>({});
  const [holidaysByDate, setHolidaysByDate] = useState<Record<string, HolidayCalendarItem[]>>({});
  const [metrics, setMetrics] = useState({
    totalOnLeave: 0,
    totalHolidays: 0,
    totalSpecialHolidays: 0,
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0 to 11

  // Load real calendar data for current year and month
  const loadCalendarData = () => {
    startTransition(async () => {
      try {
        const data = await getTeamCalendarEventsAction(year, month);
        setLeavesByDate(data.leavesByDate || {});
        setHolidaysByDate(data.holidaysByDate || {});
        setMetrics(data.metrics);
      } catch (err) {
        console.error("Failed to load team calendar data:", err);
      }
    });
  };

  useEffect(() => {
    loadCalendarData();
  }, [year, month]);

  // Calendar matrix calculation
  const calendarData = useMemo(() => {
    // First day of current month (0: Sun, 1: Mon, ..., 6: Sat)
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    // Days in current month
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    // Days in previous month
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Previous month filler days
    const prevDays = Array.from(
      { length: firstDayOfWeek },
      (_, i) => daysInPrevMonth - firstDayOfWeek + 1 + i
    );

    // Current month days
    const currentDays = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

    // Next month filler days (to fill 35 or 42 grid cells)
    const totalCells = Math.ceil((firstDayOfWeek + daysInCurrentMonth) / 7) * 7;
    const nextDaysCount = totalCells - (prevDays.length + currentDays.length);
    const nextDays = Array.from({ length: nextDaysCount }, (_, i) => i + 1);

    return { prevDays, currentDays, nextDays };
  }, [year, month]);

  const monthName = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDay(now.getDate());
  };

  // Selected date key for querying events (YYYY-MM-DD)
  const selectedDateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
  const selectedDayLeaves = leavesByDate[selectedDateKey] || [];
  const selectedDayHolidays = holidaysByDate[selectedDateKey] || [];

  const selectedDateObj = new Date(year, month, selectedDay);
  const selectedDateFormatted = selectedDateObj.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const isTodayDate = (day: number) => {
    const now = new Date();
    return (
      now.getFullYear() === year &&
      now.getMonth() === month &&
      now.getDate() === day
    );
  };

  return (
    <div className="space-y-4 select-none">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Team Calendar</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Today Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="h-8 gap-1.5 rounded-md border-border/80 px-3 text-xs font-semibold"
          >
            <CalendarIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Today</span>
          </Button>

          {/* A picked date opens its month with that day selected. */}
          <PeriodNav
            modes={["day", "month"]}
            value={`${year}-${String(month + 1).padStart(2, "0")}`}
            onChange={(period) => {
              const [y, m, d] = period.split("-").map(Number);
              setCurrentDate(new Date(y, m - 1, 1));
              setSelectedDay(d || 1);
            }}
          />
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {/* Left Column: Interactive Month Grid */}
        <div className="space-y-4 rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5 lg:col-span-8">
          {/* Legend & Month Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-foreground">
                {monthName}
              </span>
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                <span className="font-medium text-foreground">Team Leave</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span className="font-medium text-foreground">Holiday</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" />
                <span className="font-medium text-foreground">Optional Holiday</span>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="overflow-hidden rounded-md border border-border/70 bg-background">
            {/* Days Header */}
            <div className="grid grid-cols-7 border-b border-border/70 bg-muted/40 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* Days Body */}
            <div className="grid grid-cols-7 divide-x divide-y divide-border/60">
              {/* Previous month grey days */}
              {calendarData.prevDays.map((d, idx) => (
                <div
                  key={`prev-${idx}-${d}`}
                  className="min-h-[85px] p-2 bg-muted/15 text-muted-foreground/40 text-xs select-none"
                >
                  <span className="font-medium">{d}</span>
                </div>
              ))}

              {/* Current month days */}
              {calendarData.currentDays.map((day) => {
                const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayLeaves = leavesByDate[dateKey] || [];
                const dayHolidays = holidaysByDate[dateKey] || [];
                const isToday = isTodayDate(day);
                const isSelected = selectedDay === day;

                return (
                  <div
                    key={`curr-${day}`}
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "min-h-[85px] p-1.5 text-xs transition-all cursor-pointer flex flex-col justify-between hover:bg-muted/30",
                      isToday && "bg-blue-50/50 dark:bg-blue-500/10",
                      isSelected && "ring-2 ring-inset ring-blue-500 bg-blue-50/40 dark:bg-blue-500/10"
                    )}
                  >
                    {/* Top Day Number */}
                    <div className="flex items-center justify-between">
                      {isToday ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white dark:bg-blue-500">
                          {day}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "font-semibold pl-0.5",
                            isSelected ? "font-bold text-blue-600 dark:text-blue-400" : "text-foreground"
                          )}
                        >
                          {day}
                        </span>
                      )}

                      {isToday && (
                        <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Events / Badges */}
                    <div className="space-y-1 mt-1">
                      {/* Holidays */}
                      {dayHolidays.map((h) => (
                        <div
                          key={h.id}
                          className={cn(
                            "truncate rounded border-l-2 px-1.5 py-0.5 text-[11px] font-semibold",
                            h.type === "PUBLIC"
                              ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : "border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300"
                          )}
                          title={h.name}
                        >
                          {h.name}
                        </div>
                      ))}

                      {/* Leaves */}
                      {dayLeaves.length === 1 && (
                        <div
                          className="truncate rounded border-l-2 border-blue-500 bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-800 dark:bg-blue-500/15 dark:text-blue-300"
                          title={`${dayLeaves[0].employeeName} - ${dayLeaves[0].leaveType}`}
                        >
                          {dayLeaves[0].employeeName.split(" ")[0]} ({dayLeaves[0].leaveTypeCode})
                        </div>
                      )}

                      {dayLeaves.length > 1 && (
                        <div className="inline-flex w-full items-center gap-1 truncate rounded border-l-2 border-blue-500 bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">
                          <span>{dayLeaves.length} on leave</span>
                          <Users className="w-2.5 h-2.5 ml-auto shrink-0" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Next month filler days */}
              {calendarData.nextDays.map((d, idx) => (
                <div
                  key={`next-${idx}-${d}`}
                  className="min-h-[85px] p-2 bg-muted/15 text-muted-foreground/40 text-xs select-none"
                >
                  <span className="font-medium">{d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Summary Indicators */}
          <div className="flex flex-wrap items-center justify-start gap-6 text-xs font-semibold pt-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-foreground">
                <strong className="text-foreground">{metrics.totalOnLeave}</strong> On Leave This Month
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-foreground">
                <strong className="text-foreground">{metrics.totalHolidays}</strong> Public Holidays
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              <span className="text-foreground">
                <strong className="text-foreground">{metrics.totalSpecialHolidays}</strong> Special / Optional
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Selected Day's Events Card */}
        <div className="space-y-5 rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5 lg:col-span-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                <CalendarIcon className="h-4 w-4" />
              </span>
              <h3 className="text-[15px] font-semibold text-foreground">
                {isTodayDate(selectedDay) ? "Today's Schedule" : "Scheduled Events"}
              </h3>
            </div>
            <p className="mt-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
              {selectedDateFormatted}
            </p>
          </div>

          {/* Holidays on this day */}
          {selectedDayHolidays.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Holidays ({selectedDayHolidays.length})
              </div>
              <div className="space-y-2">
                {selectedDayHolidays.map((h) => (
                  <div
                    key={h.id}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md border border-l-4 p-3",
                      h.type === "PUBLIC"
                        ? "border-border/70 border-l-emerald-500"
                        : "border-border/70 border-l-violet-500"
                    )}
                  >
                    <div>
                      <div className="font-bold text-xs text-foreground">{h.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {h.description || (h.type === "PUBLIC" ? "Public / Gazetted Holiday" : "Company / Optional Holiday")}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        h.type === "PUBLIC"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                      )}
                    >
                      {h.type === "PUBLIC" ? "Holiday" : "Optional"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leaves on this day */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              On Leave ({selectedDayLeaves.length})
            </div>

            {selectedDayLeaves.length === 0 && selectedDayHolidays.length === 0 ? (
              <div className="space-y-2 rounded-md border border-dashed border-border/80 bg-muted/20 p-8 text-center text-muted-foreground">
                <CalendarCheck className="w-8 h-8 mx-auto text-muted-foreground/60" />
                <div className="text-xs font-semibold text-foreground">
                  No Team Leaves or Holidays
                </div>
                <p className="text-xs text-muted-foreground">
                  All team members are scheduled to be available on this date.
                </p>
              </div>
            ) : selectedDayLeaves.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 italic">
                No individual team members on leave on this date.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
                {selectedDayLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="flex items-start gap-3 rounded-md border border-l-4 border-border/70 border-l-blue-500 bg-background p-3 transition-colors hover:bg-muted/40"
                  >
                    <UserAvatar
                      name={leave.employeeName}
                      image={leave.avatarUrl}
                      className="h-8 w-8 bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                    >
                      {leave.avatarText}
                    </UserAvatar>

                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="font-semibold text-foreground text-xs leading-tight truncate">
                          {leave.employeeName}
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            leave.status === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                          )}
                        >
                          {leave.status === "APPROVED" ? "Approved" : "Pending"}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground font-medium">
                        {leave.leaveType} ({leave.leaveTypeCode})
                      </div>

                      <div className="text-xs text-muted-foreground/80 flex items-center gap-1.5 pt-0.5">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span>{leave.dateRangeDisplay}</span>
                      </div>

                      {leave.reason && (
                        <p className="text-xs text-muted-foreground/70 italic pt-0.5 truncate" title={leave.reason}>
                          &ldquo;{leave.reason}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
