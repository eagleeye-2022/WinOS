"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(1);
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDay(now.getDate());
  };

  const handleMonthSelect = (val: string) => {
    const [m, y] = val.split("-").map(Number);
    setCurrentDate(new Date(y, m, 1));
    setSelectedDay(1);
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

  // Generate Month Options for select dropdown
  const monthOptions = useMemo(() => {
    const opts = [];
    const baseYear = new Date().getFullYear();
    for (let y = baseYear - 1; y <= baseYear + 1; y++) {
      for (let m = 0; m < 12; m++) {
        const d = new Date(y, m, 1);
        const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        opts.push({ value: `${m}-${y}`, label });
      }
    }
    return opts;
  }, []);

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Team Calendar
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            View team leaves, public holidays, and important organization dates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Today Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5 border-border"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-primary" />
            <span>Today</span>
          </Button>

          {/* Month Navigation Prev/Next */}
          <div className="flex items-center border rounded-xl overflow-hidden bg-background">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handlePrevMonth}
              className="h-9 w-9 rounded-none text-muted-foreground hover:text-foreground"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <span className="px-3 text-xs font-bold text-foreground min-w-[110px] text-center">
              {monthName}
            </span>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              className="h-9 w-9 rounded-none text-muted-foreground hover:text-foreground"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Month/Year Quick Select */}
          <Select
            value={`${month}-${year}`}
            onValueChange={handleMonthSelect}
          >
            <SelectTrigger className="h-9 w-36 rounded-xl text-xs bg-background">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Month Grid */}
        <div className="lg:col-span-8 bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
          {/* Legend & Month Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground tracking-tight">
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
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
                <span className="font-medium text-foreground">Optional Holiday</span>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="border border-border/80 rounded-xl overflow-hidden bg-background">
            {/* Days Header */}
            <div className="grid grid-cols-7 text-center bg-muted/40 border-b text-[11px] font-semibold text-muted-foreground py-2.5">
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
                      isToday && "bg-blue-50/40 dark:bg-blue-950/20",
                      isSelected && "ring-2 ring-inset ring-primary bg-primary/5"
                    )}
                  >
                    {/* Top Day Number */}
                    <div className="flex items-center justify-between">
                      {isToday ? (
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px] shadow-2xs">
                          {day}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "font-semibold pl-0.5",
                            isSelected ? "text-primary font-bold" : "text-foreground"
                          )}
                        >
                          {day}
                        </span>
                      )}

                      {isToday && (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
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
                            "px-1.5 py-0.5 rounded text-[9px] font-bold truncate",
                            h.type === "PUBLIC"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                          )}
                          title={h.name}
                        >
                          {h.name}
                        </div>
                      ))}

                      {/* Leaves */}
                      {dayLeaves.length === 1 && (
                        <div
                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 truncate"
                          title={`${dayLeaves[0].employeeName} - ${dayLeaves[0].leaveType}`}
                        >
                          {dayLeaves[0].employeeName.split(" ")[0]} ({dayLeaves[0].leaveTypeCode})
                        </div>
                      )}

                      {dayLeaves.length > 1 && (
                        <div className="inline-flex items-center gap-1 w-full px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 truncate">
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
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-foreground">
                <strong className="text-foreground">{metrics.totalSpecialHolidays}</strong> Special / Optional
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Selected Day's Events Card */}
        <div className="lg:col-span-4 bg-card border rounded-2xl p-5 shadow-2xs space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">
                {isTodayDate(selectedDay) ? "Today's Schedule" : "Scheduled Events"}
              </h3>
            </div>
            <p className="text-xs text-primary font-semibold mt-1">
              {selectedDateFormatted}
            </p>
          </div>

          {/* Holidays on this day */}
          {selectedDayHolidays.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Holidays ({selectedDayHolidays.length})
              </div>
              <div className="space-y-2">
                {selectedDayHolidays.map((h) => (
                  <div
                    key={h.id}
                    className={cn(
                      "p-3 rounded-xl border flex items-center justify-between gap-2",
                      h.type === "PUBLIC"
                        ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50"
                        : "bg-purple-50/60 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900/50"
                    )}
                  >
                    <div>
                      <div className="font-bold text-xs text-foreground">{h.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {h.description || (h.type === "PUBLIC" ? "Public / Gazetted Holiday" : "Company / Optional Holiday")}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] font-bold border",
                        h.type === "PUBLIC"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-200"
                          : "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-200"
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
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              On Leave ({selectedDayLeaves.length})
            </div>

            {selectedDayLeaves.length === 0 && selectedDayHolidays.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed text-muted-foreground space-y-2 bg-muted/10">
                <CalendarCheck className="w-8 h-8 mx-auto text-muted-foreground/60" />
                <div className="text-xs font-semibold text-foreground">
                  No Team Leaves or Holidays
                </div>
                <p className="text-[11px] text-muted-foreground">
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
                    className="flex items-start gap-3 p-3 rounded-xl border bg-background hover:bg-muted/30 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden">
                      {leave.avatarUrl ? (
                        <img
                          src={leave.avatarUrl}
                          alt={leave.employeeName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{leave.avatarText}</span>
                      )}
                    </div>

                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="font-semibold text-foreground text-xs leading-tight truncate">
                          {leave.employeeName}
                        </div>
                        <span
                          className={cn(
                            "px-1.5 py-0.2 rounded text-[9px] font-semibold border shrink-0",
                            leave.status === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                          )}
                        >
                          {leave.status === "APPROVED" ? "Approved" : "Pending"}
                        </span>
                      </div>

                      <div className="text-[11px] text-muted-foreground font-medium">
                        {leave.leaveType} ({leave.leaveTypeCode})
                      </div>

                      <div className="text-[10px] text-muted-foreground/80 flex items-center gap-1.5 pt-0.5">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span>{leave.dateRangeDisplay}</span>
                      </div>

                      {leave.reason && (
                        <p className="text-[10px] text-muted-foreground/70 italic pt-0.5 truncate" title={leave.reason}>
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
