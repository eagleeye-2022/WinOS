"use client";

import { getMonthGridDays, isSameDay, formatTime } from "../utils";
import type { CalendarEventView } from "../queries";

type Props = {
  anchorDate: Date;
  events: CalendarEventView[];
  onSelectEvent: (event: CalendarEventView) => void;
  onSelectSlot: (start: Date) => void;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarMonthView({ anchorDate, events, onSelectEvent, onSelectSlot }: Props) {
  const days = getMonthGridDays(anchorDate);
  const currentMonth = anchorDate.getMonth();
  const today = new Date();

  function eventsForDay(day: Date) {
    return events
      .filter((e) => isSameDay(e.start, day))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden bg-background text-foreground">
      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-border bg-card">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground">
            {label}
          </div>
        ))}
      </div>

      {/* Month Days Grid */}
      <div className="grid flex-1 grid-cols-7 grid-rows-6 h-full overflow-y-auto">
        {days.map((day) => {
          const dayEvents = eventsForDay(day);
          const isCurrentMonth = day.getMonth() === currentMonth;
          const isToday = isSameDay(day, today);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectSlot(day)}
              className={`flex min-h-24 flex-col items-stretch gap-1 border-b border-r border-border p-2 text-left transition-colors ${
                isCurrentMonth ? "bg-transparent hover:bg-primary/5" : "bg-muted/30 text-muted-foreground/50"
              } ${isToday ? "bg-primary/10" : ""}`}
            >
              <span
                className={`self-start rounded-full px-2 py-0.5 text-xs font-bold ${
                  isToday
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : isCurrentMonth
                    ? "text-foreground"
                    : "text-muted-foreground/60"
                }`}
              >
                {day.getDate()}
              </span>
              <div className="flex flex-col gap-1 overflow-hidden pt-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <span
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(event);
                    }}
                    className="truncate rounded-md bg-primary/15 border border-primary/40 px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/25 transition-all"
                  >
                    {event.isAllDay ? event.title : `${formatTime(event.start)} ${event.title}`}
                  </span>
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] font-medium text-primary pl-1">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


