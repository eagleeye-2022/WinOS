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
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="grid grid-cols-7 border-b">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {days.map((day) => {
          const dayEvents = eventsForDay(day);
          const isCurrentMonth = day.getMonth() === currentMonth;
          const isToday = isSameDay(day, today);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectSlot(day)}
              className={`flex min-h-24 flex-col items-stretch gap-1 border-b border-l p-1.5 text-left ${
                isCurrentMonth ? "" : "bg-muted/20 text-muted-foreground/50"
              }`}
            >
              <span
                className={`self-start rounded-full px-1.5 text-xs font-medium ${
                  isToday ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {day.getDate()}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((event) => (
                  <span
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(event);
                    }}
                    className="truncate rounded bg-primary/15 px-1 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/25"
                  >
                    {event.isAllDay ? event.title : `${formatTime(event.start)} ${event.title}`}
                  </span>
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">
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
