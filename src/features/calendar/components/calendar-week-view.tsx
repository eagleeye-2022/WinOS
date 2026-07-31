"use client";

import { useMemo } from "react";
import { getWeekDays, isSameDay, formatShortDate, formatTime } from "../utils";
import type { CalendarEventView } from "../queries";

type Props = {
  anchorDate: Date;
  events: CalendarEventView[];
  onSelectEvent: (event: CalendarEventView) => void;
  onSelectSlot: (start: Date) => void;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function CalendarWeekView({ anchorDate, events, onSelectEvent, onSelectSlot }: Props) {
  const days = useMemo(() => getWeekDays(anchorDate), [anchorDate]);
  const now = new Date();

  function eventsForDay(day: Date) {
    return events
      .filter((e) => isSameDay(e.start, day))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  // Calculate current time line position in hours
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeTop = (currentHour + currentMinute / 60) * 60; // 60px per hour

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden bg-background text-foreground">
      {/* Header Row with Day Names & Date Badges */}
      <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-border bg-card sticky top-0 z-10 select-none">
        <div className="flex flex-col items-center justify-center border-r border-border py-2.5 px-1 text-center">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">GMT</span>
          <span className="text-[11px] font-semibold text-primary">+05:30</span>
        </div>

        {days.map((day) => {
          const isToday = isSameDay(day, now);
          const dayNum = day.getDate();
          const dayName = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day);

          return (
            <div
              key={day.toISOString()}
              className={`border-r border-border py-2.5 px-2 text-center transition-colors ${
                isToday ? "bg-primary/10" : ""
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <span className={`text-base font-bold ${isToday ? "text-primary" : "text-foreground"}`}>
                  {dayNum}
                </span>
                <span className={`text-xs font-medium ${isToday ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                  {dayName}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hourly Scrollable Grid Body */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="grid grid-cols-[80px_repeat(7,1fr)] min-h-[1440px] relative">
          
          {/* Time Column (12pm, 1pm, 2pm...) */}
          <div className="flex flex-col border-r border-border bg-muted/20 select-none z-10">
            {HOURS.map((h) => {
              const label =
                h === 0
                  ? "12 AM"
                  : h === 12
                  ? "12 PM"
                  : h < 12
                  ? `${h} AM`
                  : `${h - 12} PM`;

              return (
                <div
                  key={h}
                  className="h-[60px] border-b border-border/40 pr-3 pt-1 text-right text-[11px] font-medium text-muted-foreground relative"
                >
                  {label.toLowerCase()}
                </div>
              );
            })}
          </div>

          {/* Current Time Line Indicator across all columns */}
          <div
            style={{ top: `${currentTimeTop}px` }}
            className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
          >
            <div className="w-[80px] flex justify-end pr-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
            </div>
            <div className="flex-1 h-[1.5px] bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          </div>

          {/* Day Grid Columns */}
          {days.map((day) => {
            const dayEvents = eventsForDay(day);
            const isToday = isSameDay(day, now);

            return (
              <div
                key={day.toISOString()}
                className={`relative border-r border-border ${
                  isToday ? "bg-primary/5" : ""
                }`}
              >
                {/* 24 Hourly Slots */}
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => {
                      const slot = new Date(day);
                      slot.setHours(h, 0, 0, 0);
                      onSelectSlot(slot);
                    }}
                    className="block h-[60px] w-full border-b border-border/40 hover:bg-primary/10 transition-colors group cursor-pointer"
                  >
                    <span className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-primary pl-2 pt-1 block text-left">
                      + Add event
                    </span>
                  </button>
                ))}

                {/* Render Events */}
                {dayEvents.map((event) => {
                  const startHour = event.start.getHours() + event.start.getMinutes() / 60;
                  const endHour = event.end.getHours() + event.end.getMinutes() / 60;
                  const top = startHour * 60;
                  const durationHours = Math.max(0.5, endHour - startHour);
                  const height = durationHours * 60 - 2;

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onSelectEvent(event)}
                      style={{ top: `${top}px`, height: `${height}px` }}
                      className="absolute left-1 right-1 z-10 overflow-hidden rounded-xl bg-primary/15 border border-primary/40 p-2 text-left text-xs font-semibold text-primary shadow-2xs hover:bg-primary/25 transition-all flex flex-col justify-between backdrop-blur-xs"
                    >
                      <div className="space-y-0.5">
                        <p className="truncate font-bold leading-tight">
                          {event.title}
                        </p>
                        {event.description && (
                          <p className="truncate text-[10px] opacity-80 font-normal">
                            {event.description}
                          </p>
                        )}
                      </div>
                      <p className="text-[10px] font-medium opacity-90">
                        {formatTime(event.start)} - {formatTime(event.end)}
                      </p>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


