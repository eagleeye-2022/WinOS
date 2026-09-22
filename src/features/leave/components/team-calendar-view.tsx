"use client";

import React, { useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  Sparkles,
  CheckCircle2,
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

interface CalendarEvent {
  day: number;
  type: "leave" | "holiday" | "special";
  title: string;
  time?: string;
  count?: number;
}

export function TeamCalendarView() {
  const [selectedMonth, setSelectedMonth] = useState("May 2025");
  const [selectedDay, setSelectedDay] = useState(20);

  const events: Record<number, CalendarEvent[]> = {
    1: [
      { day: 1, type: "holiday", title: "Labour Day" },
      { day: 1, type: "special", title: "Special Holiday" },
    ],
    5: [{ day: 5, type: "leave", title: "2 on leave", count: 2 }],
    9: [{ day: 9, type: "leave", title: "2 on leave", count: 2 }],
    13: [{ day: 13, type: "leave", title: "2 on leave", count: 2 }],
    19: [{ day: 19, type: "leave", title: "2 on leave", count: 2 }],
    22: [
      { day: 22, type: "leave", title: "2 on leave", count: 2 },
      { day: 22, type: "leave", title: "10:30 AM", time: "10:30 AM" },
    ],
    26: [{ day: 26, type: "holiday", title: "Republic Day" }],
    29: [{ day: 29, type: "leave", title: "2 on leave", count: 2 }],
  };

  const todayEvents = [
    {
      id: "ev-1",
      name: "Vikram Singh",
      initials: "VS",
      bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
      type: "Half Day (Second Half)",
      duration: "20 May 2025 (0.5 Day)",
    },
    {
      id: "ev-2",
      name: "Sneha Iyer",
      initials: "SK",
      bg: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
      type: "Casual Leave",
      duration: "20 May 2025 (1 Day)",
    },
    {
      id: "ev-3",
      name: "Rahul Mehta",
      initials: "RM",
      bg: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
      type: "Annual Leave",
      duration: "21 May 2025 - 23 May 2025 (3 Days)",
    },
  ];

  // Calendar cells for May 2025 (May 1 starts on Thursday -> 4 days of April 27, 28, 29, 30)
  const prevMonthDays = [27, 28, 29, 30];
  const currentMonthDays = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Team Calendar
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            View team leave, holidays and important dates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSelectedDay(20)}
            className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Today</span>
          </Button>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-9 w-36 rounded-xl text-xs bg-background">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Apr 2025">Apr 2025</SelectItem>
              <SelectItem value="May 2025">May 2025</SelectItem>
              <SelectItem value="Jun 2025">Jun 2025</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Month Grid */}
        <div className="lg:col-span-8 bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
          {/* Legend */}
          <div className="flex items-center gap-5 text-xs text-muted-foreground pb-2 border-b">
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
              <span className="font-medium text-foreground">Special Holiday</span>
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
              {prevMonthDays.map((d) => (
                <div
                  key={`prev-${d}`}
                  className="min-h-[85px] p-2 bg-muted/10 text-muted-foreground/40 text-xs select-none"
                >
                  <span className="font-medium">{d}</span>
                </div>
              ))}

              {/* Current month days */}
              {currentMonthDays.map((day) => {
                const dayEvents = events[day] || [];
                const isToday = day === 20;
                const isSelected = selectedDay === day;

                return (
                  <div
                    key={`curr-${day}`}
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "min-h-[85px] p-1.5 text-xs transition-colors cursor-pointer flex flex-col justify-between hover:bg-muted/30",
                      isToday && "bg-blue-50/40 dark:bg-blue-950/20",
                      isSelected && "ring-1 ring-inset ring-primary"
                    )}
                  >
                    {/* Top Day Number */}
                    <div className="flex items-center justify-between">
                      {isToday ? (
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px] shadow-2xs">
                          {day}
                        </span>
                      ) : (
                        <span className="font-medium text-foreground pl-0.5">
                          {day}
                        </span>
                      )}

                      {isToday && (
                        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Events / Badges */}
                    <div className="space-y-1 mt-1">
                      {dayEvents.map((ev, idx) => (
                        <div key={idx}>
                          {ev.type === "holiday" && (
                            <span className="inline-block w-full px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 truncate">
                              {ev.title}
                            </span>
                          )}

                          {ev.type === "special" && (
                            <span className="inline-block w-full px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 truncate">
                              {ev.title}
                            </span>
                          )}

                          {ev.type === "leave" && ev.count && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 truncate">
                              <span>{ev.title}</span>
                              <Users className="w-2.5 h-2.5" />
                            </span>
                          )}

                          {ev.type === "leave" && ev.time && (
                            <span className="inline-flex items-center gap-1 text-[9px] text-blue-600 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                              <span>{ev.time}</span>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Summary Indicators */}
          <div className="flex items-center justify-start gap-6 text-xs font-semibold pt-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-foreground">10 On Leave</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-foreground">3 Holidays</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-foreground">2 Special Holidays</span>
            </div>
          </div>
        </div>

        {/* Right Column: Today's Events Card */}
        <div className="lg:col-span-4 bg-card border rounded-2xl p-5 shadow-2xs space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">
                Today's Events
              </h3>
            </div>
            <p className="text-xs text-primary font-medium mt-1">
              Tuesday, 20 May 2025
            </p>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-bold text-foreground">
              On Leave Today ({todayEvents.length})
            </div>

            <div className="space-y-3">
              {todayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-3 p-3 rounded-xl border bg-background hover:bg-muted/30 transition-colors"
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0",
                      ev.bg
                    )}
                  >
                    {ev.initials}
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-semibold text-foreground text-xs leading-tight">
                      {ev.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-medium">
                      {ev.type}
                    </div>
                    <div className="text-[10px] text-muted-foreground/80">
                      {ev.duration}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
