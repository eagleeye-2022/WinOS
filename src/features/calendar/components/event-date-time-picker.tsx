"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, Clock, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  start: Date;
  end: Date;
  onStartChange: (date: Date) => void;
  onEndChange: (date: Date) => void;
  /** Current wall-clock time — owned by the parent so it can also gate the Create button. */
  now: Date;
  startError?: string;
  endError?: string;
};

type Period = "AM" | "PM";

const QUICK_HOURS_24 = [11, 12, 13, 14, 15, 16]; // 11AM, 12PM, 1PM, 2PM, 3PM, 4PM
const HOUR_MS = 60 * 60 * 1000;
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i);

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function to12Hour(hour24: number): { hour12: number; period: Period } {
  const period: Period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, period };
}

function to24Hour(hour12: number, period: Period): number {
  const h = hour12 % 12;
  return period === "PM" ? h + 12 : h;
}

function hourLabel(hour24: number): string {
  const { hour12, period } = to12Hour(hour24);
  return `${hour12}:00 ${period}`;
}

function buildDate(dateStr: string, hour12: number, minute: number, period: Period): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, to24Hour(hour12, period), minute, 0, 0);
}

function quickOptionDate(today: Date, hour24: number): Date {
  const d = new Date(today);
  d.setHours(hour24, 0, 0, 0);
  return d;
}

function isSameMinute(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() &&
    a.getMinutes() === b.getMinutes()
  );
}

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);
}

function formatTimeLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);

function HourSelect({
  value,
  onChange,
  paddingClass = "py-1.5",
}: {
  value: number;
  onChange: (hour: number) => void;
  paddingClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      if (activeRef.current) {
        activeRef.current.scrollIntoView({ block: "nearest" });
      }
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none hover:bg-accent focus:border-primary cursor-pointer",
          paddingClass
        )}
      >
        <span>{value}</span>
        <ChevronDown size={11} className="text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-36 w-14 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {HOURS_12.map((h) => (
            <button
              key={h}
              ref={h === value ? activeRef : undefined}
              type="button"
              onClick={() => {
                onChange(h);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded px-2 py-1 text-xs text-left cursor-pointer transition-colors",
                h === value
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "hover:bg-accent text-foreground"
              )}
            >
              <span>{h}</span>
              {h === value && <Check size={10} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MinuteSelect({
  value,
  onChange,
  paddingClass = "py-1.5",
}: {
  value: number;
  onChange: (minute: number) => void;
  paddingClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const options = MINUTES_60;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      if (activeRef.current) {
        activeRef.current.scrollIntoView({ block: "nearest" });
      }
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none hover:bg-accent focus:border-primary cursor-pointer",
          paddingClass
        )}
      >
        <span>{pad(value)}</span>
        <ChevronDown size={11} className="text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-36 w-16 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {options.map((m) => (
            <button
              key={m}
              ref={m === value ? activeRef : undefined}
              type="button"
              onClick={() => {
                onChange(m);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded px-2 py-1 text-xs text-left cursor-pointer transition-colors",
                m === value
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "hover:bg-accent text-foreground"
              )}
            >
              <span>{pad(m)}</span>
              {m === value && <Check size={10} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EventDateTimePicker({ start, end, onStartChange, onEndChange, now, startError, endError }: Props) {
  const isToday =
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate();

  const isTomorrow =
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate() + 1;

  const datePrefix = isToday
    ? "Today"
    : isTomorrow
      ? "Tomorrow"
      : formatDateLabel(start);

  const quickOptions = QUICK_HOURS_24.map((hour24) => {
    const date = quickOptionDate(start, hour24);
    return {
      id: `slot-${hour24}`,
      date,
      label: `${datePrefix} at ${hourLabel(hour24)}`,
      disabled: date.getTime() <= now.getTime(),
    };
  });

  const [selected, setSelected] = useState<string>(() => {
    const match = quickOptions.find((opt) => isSameMinute(opt.date, start));
    return match ? match.id : "custom";
  });

  const startParts = to12Hour(start.getHours());
  const endParts = to12Hour(end.getHours());

  function selectQuick(newStart: Date, id: string) {
    setSelected(id);
    onStartChange(newStart);
    onEndChange(new Date(newStart.getTime() + HOUR_MS));
  }

  function updateCustomStart(patch: Partial<{ dateStr: string; hour12: number; minute: number; period: Period }>) {
    const next = buildDate(
      patch.dateStr ?? dateInputValue(start),
      patch.hour12 ?? startParts.hour12,
      patch.minute ?? start.getMinutes(),
      patch.period ?? startParts.period,
    );
    onStartChange(next);
    onEndChange(new Date(next.getTime() + HOUR_MS));
  }

  function updateEnd(patch: Partial<{ hour12: number; minute: number; period: Period }>) {
    // Always anchor to the start date — end must never land on a different
    // calendar day, so this also lets the user recover from the overnight
    // case (e.g. an 11:30 PM start whose auto +1h end rolled to 12:30 AM).
    const next = buildDate(
      dateInputValue(start),
      patch.hour12 ?? endParts.hour12,
      patch.minute ?? end.getMinutes(),
      patch.period ?? endParts.period,
    );
    onEndChange(next);
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-foreground">Date &amp; Time</label>

      <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
        {/* Selected summary */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <CalendarIcon size={14} className="shrink-0 text-primary" />
          <span className="text-xs font-semibold text-foreground">{formatDateLabel(start)}</span>
          <span className="text-muted-foreground">•</span>
          <Clock size={14} className="shrink-0 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            {formatTimeLabel(start)} – {formatTimeLabel(end)}
          </span>
        </div>

        {/* Quick options */}
        <div className="space-y-1.5">
          {quickOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={opt.disabled}
              onClick={() => selectQuick(opt.date, opt.id)}
              aria-disabled={opt.disabled}
              title={opt.disabled ? "This time has already passed" : undefined}
              className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all ${
                opt.disabled
                  ? "cursor-not-allowed border-border bg-muted/30 text-muted-foreground/50"
                  : selected === opt.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-foreground hover:bg-accent"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  opt.disabled
                    ? "border-input"
                    : selected === opt.id
                      ? "border-primary bg-primary"
                      : "border-input"
                }`}
              >
                {selected === opt.id && !opt.disabled && <Check size={10} className="text-primary-foreground" />}
              </span>
              {opt.label}
              {opt.disabled && <span className="ml-auto text-[10px] uppercase tracking-wide">Past</span>}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setSelected("custom")}
            className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all ${
              selected === "custom"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-foreground hover:bg-accent"
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                selected === "custom" ? "border-primary bg-primary" : "border-input"
              }`}
            >
              {selected === "custom" && <Check size={10} className="text-primary-foreground" />}
            </span>
            Custom time
          </button>
        </div>

        {/* Custom date + time + AM/PM */}
        {selected === "custom" && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2">
            <div className="relative flex-1 min-w-[130px]">
              <CalendarIcon size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={dateInputValue(start)}
                min={dateInputValue(now)}
                onChange={(e) => updateCustomStart({ dateStr: e.target.value })}
                className="w-full rounded-md border border-input bg-background py-1.5 pl-7 pr-2 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>

            <HourSelect
              value={startParts.hour12}
              onChange={(h) => updateCustomStart({ hour12: h })}
              paddingClass="py-1.5"
            />
            <span className="text-xs text-muted-foreground">:</span>
            <MinuteSelect
              value={start.getMinutes()}
              onChange={(m) => updateCustomStart({ minute: m })}
              paddingClass="py-1.5"
            />
            <select
              value={startParts.period}
              onChange={(e) => updateCustomStart({ period: e.target.value as Period })}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-xs font-medium text-foreground outline-none focus:border-primary"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        )}

        {/* End time (auto = start + 1h, manually adjustable) */}
        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
          <span className="text-[11px] font-medium text-muted-foreground">Ends</span>
          <div className="flex items-center gap-1.5">
            <HourSelect
              value={endParts.hour12}
              onChange={(h) => updateEnd({ hour12: h })}
              paddingClass="py-1"
            />
            <span className="text-xs text-muted-foreground">:</span>
            <MinuteSelect
              value={end.getMinutes()}
              onChange={(m) => updateEnd({ minute: m })}
              paddingClass="py-1"
            />
            <select
              value={endParts.period}
              onChange={(e) => updateEnd({ period: e.target.value as Period })}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium text-foreground outline-none focus:border-primary"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>
      </div>

      {startError && <p className="text-xs text-destructive">{startError}</p>}
      {endError && <p className="text-xs text-destructive">{endError}</p>}
    </div>
  );
}
