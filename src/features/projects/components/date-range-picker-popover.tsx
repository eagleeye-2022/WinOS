"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DateRangePickerPopoverProps {
  startDate?: string; // ISO yyyy-mm-dd
  endDate?: string;
  onApply: (startDate: string, endDate: string) => void;
  onClose: () => void;
  anchorClassName?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseISO(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatDisplay(d: Date | null): string {
  if (!d) return "--";
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.round(ms / 86400000) + 1;
}

function MonthGrid({
  year,
  month,
  rangeStart,
  rangeEnd,
  onPick,
}: {
  year: number;
  month: number;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  onPick: (d: Date) => void;
}) {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const inRange = (d: Date) => {
    if (!rangeStart || !rangeEnd) return false;
    return d.getTime() > rangeStart.getTime() && d.getTime() < rangeEnd.getTime();
  };

  return (
    <div className="flex-1">
      <div className="text-center text-xs font-bold mb-2">
        {MONTH_NAMES[month]} {year}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-[10px] font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map((d, idx) => {
          if (!d) return <div key={idx} />;
          const isStart = rangeStart && isSameDay(d, rangeStart);
          const isEnd = rangeEnd && isSameDay(d, rangeEnd);
          const within = inRange(d);
          return (
            <button
              type="button"
              key={idx}
              onClick={() => onPick(d)}
              className={`h-7 w-7 mx-auto flex items-center justify-center rounded-full text-[11px] transition-colors ${
                isStart || isEnd
                  ? "bg-primary text-primary-foreground font-bold"
                  : within
                  ? "bg-primary/15 text-primary"
                  : "hover:bg-accent text-foreground"
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePickerPopover({
  startDate,
  endDate,
  onApply,
  onClose,
  anchorClassName = "",
}: DateRangePickerPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const initialStart = parseISO(startDate);
  const initialEnd = parseISO(endDate);

  const [rangeStart, setRangeStart] = useState<Date | null>(initialStart);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(initialEnd);
  const [viewDate, setViewDate] = useState<Date>(initialStart || new Date());

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

  const applyPreset = (preset: "THIS_MONTH" | "NEXT_MONTH" | "QUARTER" | "FULL_YEAR") => {
    let s: Date, e: Date;
    if (preset === "THIS_MONTH") {
      s = new Date(now.getFullYear(), now.getMonth(), 1);
      e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (preset === "NEXT_MONTH") {
      s = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      e = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    } else if (preset === "QUARTER") {
      const qStartMonth = (currentQuarter - 1) * 3;
      s = new Date(currentYear, qStartMonth, 1);
      e = new Date(currentYear, qStartMonth + 3, 0);
    } else {
      s = new Date(currentYear, 0, 1);
      e = new Date(currentYear, 11, 31);
    }
    setRangeStart(s);
    setRangeEnd(e);
    setViewDate(s);
  };

  const handlePick = (d: Date) => {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(d);
      setRangeEnd(null);
    } else if (d.getTime() < rangeStart.getTime()) {
      setRangeEnd(rangeStart);
      setRangeStart(d);
    } else {
      setRangeEnd(d);
    }
  };

  const dayCount = rangeStart && rangeEnd ? daysBetween(rangeStart, rangeEnd) : 0;

  const secondMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);

  const presets: { key: "THIS_MONTH" | "NEXT_MONTH" | "QUARTER" | "FULL_YEAR"; label: string }[] = [
    { key: "THIS_MONTH", label: "This Month" },
    { key: "NEXT_MONTH", label: "Next Month" },
    { key: "QUARTER", label: `Q${currentQuarter} ${currentYear}` },
    { key: "FULL_YEAR", label: "Full Year" },
  ];

  return (
    <div
      ref={ref}
      className={`absolute z-50 w-[520px] rounded-lg border bg-popover shadow-2xl p-4 text-xs animate-in fade-in zoom-in-95 duration-100 ${anchorClassName}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              className="rounded-full border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-accent transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
        {dayCount > 0 && (
          <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-bold text-success shrink-0">
            {dayCount} Day{dayCount !== 1 ? "s" : ""} Selected
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-md border px-3 py-2">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Start Date</div>
          <div className="font-semibold text-foreground">{formatDisplay(rangeStart)}</div>
        </div>
        <div className="rounded-md border px-3 py-2">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">End Date</div>
          <div className="font-semibold text-foreground">{formatDisplay(rangeEnd)}</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-1">
        <button
          type="button"
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
          className="p-1 rounded hover:bg-accent"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
          className="p-1 rounded hover:bg-accent"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex gap-4">
        <MonthGrid
          year={viewDate.getFullYear()}
          month={viewDate.getMonth()}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onPick={handlePick}
        />
        <MonthGrid
          year={secondMonth.getFullYear()}
          month={secondMonth.getMonth()}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onPick={handlePick}
        />
      </div>

      <div className="flex items-center justify-between border-t mt-3 pt-3">
        <button
          type="button"
          onClick={() => {
            setRangeStart(null);
            setRangeEnd(null);
          }}
          className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          Clear Dates
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-3 py-1.5 text-[11px] font-semibold hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!rangeStart || !rangeEnd}
            onClick={() => {
              if (rangeStart && rangeEnd) {
                onApply(toISO(rangeStart), toISO(rangeEnd));
              }
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Apply Range
          </button>
        </div>
      </div>
    </div>
  );
}
