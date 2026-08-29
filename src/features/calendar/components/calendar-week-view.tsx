"use client";

import { useMemo } from "react";
import { getWeekDays, isSameDay, formatTime } from "../utils";
import type { CalendarEventView } from "../queries";

type Props = {
  anchorDate: Date;
  events: CalendarEventView[];
  onSelectEvent: (event: CalendarEventView) => void;
  onSelectSlot: (start: Date) => void;
};

// Hours: 9:00 AM to 8:00 PM (9.0 to 20.0)
const OFFICE_START_HOUR = 9;
const OFFICE_END_HOUR = 20;

const OFFICE_SLOTS = [
  { hour: 9, minute: 0, label: "9:00 am", height: 60 },
  { hour: 10, minute: 0, label: "10:00 am", height: 60 },
  { hour: 11, minute: 0, label: "11:00 am", height: 60 },
  { hour: 12, minute: 0, label: "12:00 pm", height: 60 },
  { hour: 13, minute: 0, label: "1:00 pm", height: 60 },
  { hour: 14, minute: 0, label: "2:00 pm", height: 60 },
  { hour: 15, minute: 0, label: "3:00 pm", height: 60 },
  { hour: 16, minute: 0, label: "4:00 pm", height: 60 },
  { hour: 17, minute: 0, label: "5:00 pm", height: 60 },
  { hour: 18, minute: 0, label: "6:00 pm", height: 60 },
  { hour: 19, minute: 0, label: "7:00 pm", height: 60 },
  { hour: 20, minute: 0, label: "8:00 pm", height: 0 },
];

export function CalendarWeekView({ anchorDate, events, onSelectEvent, onSelectSlot }: Props) {
  const days = useMemo(() => getWeekDays(anchorDate), [anchorDate]);
  const now = new Date();

  function eventsForDay(day: Date) {
    const seen = new Set<string>();
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);

    return events
      .filter((e) => {
        if (!e?.id || !e?.start) return false;
        if (seen.has(e.id)) return false;
        const eStart = e.start instanceof Date ? e.start : new Date(e.start);
        const eEnd = e.end ? (e.end instanceof Date ? e.end : new Date(e.end)) : new Date(eStart.getTime() + 30 * 60 * 1000);
        if (isNaN(eStart.getTime()) || isNaN(eEnd.getTime())) return false;
        
        // Match any event that overlaps with this day
        if (eStart.getTime() > dayEnd.getTime() || eEnd.getTime() < dayStart.getTime()) return false;

        seen.add(e.id);
        return true;
      })
      .sort((a, b) => {
        const aStart = a.start instanceof Date ? a.start : new Date(a.start);
        const bStart = b.start instanceof Date ? b.start : new Date(b.start);
        return aStart.getTime() - bStart.getTime();
      });
  }

  // Calculate current time line position in hours (9:00 AM to 8:00 PM)
  const currentHourDec = now.getHours() + now.getMinutes() / 60;
  const isNowInOfficeHours = currentHourDec >= OFFICE_START_HOUR && currentHourDec <= OFFICE_END_HOUR;
  const currentTimeTop = (currentHourDec - OFFICE_START_HOUR) * 60; // 60px per hour

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden bg-background text-foreground">
      {/* Header Row with Day Names & Date Badges */}
      <div className="grid grid-cols-[85px_repeat(7,1fr)] border-b border-border bg-card sticky top-0 z-10 select-none">
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

      {/* Office Hours Scrollable Grid Body (9:00 AM - 8:00 PM) */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="grid grid-cols-[85px_repeat(7,1fr)] min-h-[660px] relative">
          
          {/* Time Column (9:00 am to 8:00 pm) */}
          <div className="flex flex-col border-r border-border bg-muted/20 select-none z-10">
            {OFFICE_SLOTS.map((slot, idx) => (
              <div
                key={idx}
                style={{ height: `${slot.height}px` }}
                className="border-b border-border/40 pr-3 pt-1 text-right text-[11px] font-medium text-muted-foreground relative"
              >
                {slot.label}
              </div>
            ))}
          </div>

          {/* Current Time Line Indicator across all columns */}
          {isNowInOfficeHours && (
            <div
              style={{ top: `${currentTimeTop}px` }}
              className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
            >
              <div className="w-[85px] flex justify-end pr-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
              </div>
              <div className="flex-1 h-[1.5px] bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            </div>
          )}

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
                {/* Office Hourly Slot Buttons */}
                {OFFICE_SLOTS.slice(0, -1).map((slot, idx) => (
                  <button
                    key={idx}
                    type="button"
                    style={{ height: `${slot.height}px` }}
                    onClick={() => {
                      const slotDate = new Date(day);
                      slotDate.setHours(slot.hour, slot.minute, 0, 0);
                      onSelectSlot(slotDate);
                    }}
                    className="block w-full border-b border-border/40 hover:bg-primary/10 transition-colors group cursor-pointer"
                  >
                    <span className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-primary pl-2 pt-1 block text-left">
                      + Add Event
                    </span>
                  </button>
                ))}

                {/* Render Events inside Office Hours */}
                {dayEvents.map((event, idx) => {
                  const eStart = event.start instanceof Date ? event.start : new Date(event.start);
                  const eEnd = event.end ? (event.end instanceof Date ? event.end : new Date(event.end)) : new Date(eStart.getTime() + 1800000);

                  const startHourDec = isSameDay(eStart, day)
                    ? eStart.getHours() + eStart.getMinutes() / 60
                    : OFFICE_START_HOUR;

                  const endHourDec = isSameDay(eEnd, day)
                    ? eEnd.getHours() + eEnd.getMinutes() / 60
                    : OFFICE_END_HOUR;

                  const clampedStart = Math.max(OFFICE_START_HOUR, Math.min(OFFICE_END_HOUR - 0.5, startHourDec));
                  const clampedEnd = Math.max(clampedStart + 0.5, Math.min(OFFICE_END_HOUR, endHourDec));

                  const top = (clampedStart - OFFICE_START_HOUR) * 60;
                  const durationHours = clampedEnd - clampedStart;
                  const height = Math.max(28, durationHours * 60 - 2);

                  return (
                    <button
                      key={`${day.toISOString()}-${event.id}-${idx}`}
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
                        {formatTime(eStart)} - {formatTime(eEnd)}
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



