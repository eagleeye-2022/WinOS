"use client";

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
  const days = getWeekDays(anchorDate);

  function eventsForDay(day: Date) {
    return events
      .filter((e) => isSameDay(e.start, day))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className="border-l px-2 py-2 text-center">
            <p className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day)}
            </p>
            <p className="text-sm font-semibold">{formatShortDate(day)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[60px_repeat(7,1fr)]">
        <div className="flex flex-col">
          {HOURS.map((h) => (
            <div key={h} className="h-14 border-b px-2 text-right text-[11px] text-muted-foreground/60">
              {h === 0 ? "" : `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`}
            </div>
          ))}
        </div>

        {days.map((day) => {
          const dayEvents = eventsForDay(day);
          return (
            <div key={day.toISOString()} className="relative border-l">
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    const slot = new Date(day);
                    slot.setHours(h, 0, 0, 0);
                    onSelectSlot(slot);
                  }}
                  className="block h-14 w-full border-b hover:bg-accent/30"
                />
              ))}

              {dayEvents.map((event) => {
                const top = (event.start.getHours() + event.start.getMinutes() / 60) * 56;
                const durationHours = Math.max(
                  0.5,
                  (event.end.getTime() - event.start.getTime()) / 3600000,
                );
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onSelectEvent(event)}
                    style={{ top, height: durationHours * 56 - 2 }}
                    className="absolute left-1 right-1 overflow-hidden rounded-md bg-primary/15 border border-primary/40 px-1.5 py-0.5 text-left text-[11px] font-medium text-primary hover:bg-primary/25"
                  >
                    <p className="truncate">{event.title}</p>
                    <p className="truncate text-[10px] opacity-80">{formatTime(event.start)}</p>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
