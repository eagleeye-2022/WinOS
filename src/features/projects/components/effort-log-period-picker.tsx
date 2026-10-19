"use client";

import React, { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

export type PeriodMode = "Day" | "Month" | "Range";

const MODES: PeriodMode[] = ["Day", "Month", "Range"];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date | null, b: Date | null) =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayDiff = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
const fmt = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/** Monday-first grid of the given month, padded with the neighbouring months' days. */
function monthGrid(viewMonth: Date): Date[] {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // Mon = 0
  const start = addDays(first, -lead);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/**
 * The effort-log date control: one button showing the current period (with ‹ › to step it); clicking
 * the label opens a popover with Day / Month / Range tabs, each with its own picker.
 */
export function EffortLogPeriodPicker({
  mode,
  day,
  month,
  rangeFrom,
  rangeTo,
  onDay,
  onMonth,
  onRange,
}: {
  mode: PeriodMode;
  day: Date;
  /** First day of the selected month. */
  month: Date;
  rangeFrom: Date;
  rangeTo: Date;
  onDay: (d: Date) => void;
  onMonth: (firstOfMonth: Date) => void;
  onRange: (from: Date, to: Date) => void;
}) {
  const today = startOfDay(new Date());
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PeriodMode>(mode);
  const [viewMonth, setViewMonth] = useState(() => new Date(day.getFullYear(), day.getMonth(), 1));
  const [viewYear, setViewYear] = useState(month.getFullYear());
  // Range being picked: first click sets the start, second click the end.
  const [pendingFrom, setPendingFrom] = useState<Date | null>(null);
  const [hovered, setHovered] = useState<Date | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const openPopover = () => {
    setTab(mode);
    const anchor = mode === "Month" ? month : mode === "Range" ? rangeFrom : day;
    setViewMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    setViewYear(month.getFullYear());
    setPendingFrom(null);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label =
    mode === "Month"
      ? month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
      : mode === "Range"
        ? sameDay(rangeFrom, rangeTo)
          ? fmt(rangeFrom)
          : `${fmt(rangeFrom)} – ${fmt(rangeTo)}`
        : `${fmt(day)}${sameDay(day, today) ? " (Today)" : ""}`;

  const step = (dir: -1 | 1) => {
    if (mode === "Month") onMonth(new Date(month.getFullYear(), month.getMonth() + dir, 1));
    else if (mode === "Range") {
      const len = dayDiff(rangeFrom, rangeTo) + 1;
      onRange(addDays(rangeFrom, dir * len), addDays(rangeTo, dir * len));
    } else onDay(addDays(day, dir));
  };
  const unit = mode === "Month" ? "Month" : mode === "Range" ? "Range" : "Day";

  const pickDay = (d: Date) => {
    if (tab === "Day") {
      onDay(d);
      setOpen(false);
      return;
    }
    // Range
    if (!pendingFrom) {
      setPendingFrom(d);
      return;
    }
    const [from, to] = d < pendingFrom ? [d, pendingFrom] : [pendingFrom, d];
    onRange(from, to);
    setPendingFrom(null);
    setOpen(false);
  };

  const inRange = (d: Date) => {
    if (tab !== "Range") return false;
    if (pendingFrom) {
      const end = hovered ?? pendingFrom;
      const [a, b] = end < pendingFrom ? [end, pendingFrom] : [pendingFrom, end];
      return d >= a && d <= b;
    }
    return mode === "Range" && d >= startOfDay(rangeFrom) && d <= startOfDay(rangeTo);
  };
  const isSelected = (d: Date) =>
    tab === "Day"
      ? sameDay(d, day)
      : pendingFrom
        ? sameDay(d, pendingFrom)
        : mode === "Range" && (sameDay(d, rangeFrom) || sameDay(d, rangeTo));

  const navBtn =
    "rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer";

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-2xs">
        <button type="button" onClick={() => step(-1)} className={navBtn} title={`Previous ${unit}`}>
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openPopover())}
          className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors"
          aria-haspopup="dialog"
          aria-expanded={open}
          title="Pick a day, month or date range"
        >
          <CalendarIcon size={13} className="text-primary" />
          <span>{label}</span>
        </button>
        <button type="button" onClick={() => step(1)} className={navBtn} title={`Next ${unit}`}>
          <ChevronRight size={14} />
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Choose period"
          className="absolute left-1/2 top-full z-50 mt-1.5 w-72 -translate-x-1/2 rounded-xl border border-border bg-popover p-3 text-xs text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {/* Mode tabs */}
          <div className="mb-3 grid grid-cols-3 rounded-md border border-border bg-muted/40 p-0.5" role="tablist">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={tab === m}
                onClick={() => {
                  setTab(m);
                  setPendingFrom(null);
                }}
                className={`rounded px-2 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  tab === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {tab === "Month" ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <button type="button" onClick={() => setViewYear((y) => y - 1)} className={navBtn} title="Previous year">
                  <ChevronLeft size={14} />
                </button>
                <span className="font-semibold">{viewYear}</span>
                <button type="button" onClick={() => setViewYear((y) => y + 1)} className={navBtn} title="Next year">
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTHS.map((name, i) => {
                  const selected = mode === "Month" && month.getFullYear() === viewYear && month.getMonth() === i;
                  const current = today.getFullYear() === viewYear && today.getMonth() === i;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        onMonth(new Date(viewYear, i, 1));
                        setOpen(false);
                      }}
                      className={`rounded-md py-2 font-medium transition-colors cursor-pointer ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : current
                            ? "border border-primary/50 text-primary hover:bg-accent"
                            : "hover:bg-accent"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setViewMonth((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
                  className={navBtn}
                  title="Previous month"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="font-semibold">
                  {viewMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                </span>
                <button
                  type="button"
                  onClick={() => setViewMonth((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
                  className={navBtn}
                  title="Next month"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="py-1 text-xs font-semibold text-muted-foreground">
                    {w}
                  </span>
                ))}
                {monthGrid(viewMonth).map((d) => {
                  const outside = d.getMonth() !== viewMonth.getMonth();
                  const selected = isSelected(d);
                  const ranged = inRange(d);
                  return (
                    <button
                      key={d.toISOString()}
                      type="button"
                      onClick={() => pickDay(d)}
                      onMouseEnter={() => setHovered(d)}
                      className={`h-8 rounded-md text-xs transition-colors cursor-pointer ${
                        selected
                          ? "bg-primary font-semibold text-primary-foreground"
                          : ranged
                            ? "bg-primary/15 text-foreground"
                            : sameDay(d, today)
                              ? "border border-primary/50 font-semibold text-primary hover:bg-accent"
                              : outside
                                ? "text-muted-foreground/50 hover:bg-accent"
                                : "hover:bg-accent"
                      }`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {tab === "Range"
                  ? pendingFrom
                    ? `From ${fmt(pendingFrom)} — now pick the end date`
                    : "Pick the start date, then the end date"
                  : "Pick a day"}
              </p>
            </>
          )}

          {/* Shortcuts */}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
            <button
              type="button"
              onClick={() => {
                if (tab === "Month") onMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                else if (tab === "Range") onRange(addDays(today, -6), today);
                else onDay(today);
                setOpen(false);
              }}
              className="text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              {tab === "Month" ? "This Month" : tab === "Range" ? "Last 7 Days" : "Today"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
