"use client";

import { useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * A selectable period, encoded as a string:
 * - day   "YYYY-MM-DD"
 * - range "YYYY-MM-DD~YYYY-MM-DD" (inclusive)
 * - month "YYYY-MM"
 * - year  "YYYY"
 */
export type Period = string;
export type PeriodMode = "day" | "range" | "month" | "year";

const ALL_MODES: PeriodMode[] = ["day", "range", "month", "year"];
const MODE_LABEL: Record<PeriodMode, string> = { day: "Date", range: "Range", month: "Month", year: "Year" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const RANGE_SEP = "~";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function keyOf(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m, d));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function addDays(key: string, by: number) {
  const [y, m, d] = key.split("-").map(Number);
  return keyOf(y, m - 1, d + by);
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function todayKey() {
  const now = new Date();
  return keyOf(now.getFullYear(), now.getMonth(), now.getDate());
}

export function rangePeriod(from: string, to: string): Period {
  return from <= to ? `${from}${RANGE_SEP}${to}` : `${to}${RANGE_SEP}${from}`;
}

export function periodKind(period: Period): PeriodMode {
  if (period.includes(RANGE_SEP)) return "range";
  const parts = period.split("-").length;
  return parts >= 3 ? "day" : parts === 2 ? "month" : "year";
}

/** This month ("YYYY-MM") or this year ("YYYY"), in the browser's time zone. */
export function currentPeriod(mode: "month" | "year"): Period {
  const now = new Date();
  return mode === "year" ? String(now.getFullYear()) : `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** First and last "YYYY-MM-DD" of a period. */
export function periodBounds(period: Period): { start: string; end: string } {
  const kind = periodKind(period);
  if (kind === "range") {
    const [start, end] = period.split(RANGE_SEP);
    return { start, end };
  }
  if (kind === "day") return { start: period, end: period };
  const [y, m] = period.split("-").map(Number);
  if (!m) return { start: `${y}-01-01`, end: `${y}-12-31` };
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}` };
}

/** Whether a date range (inclusive "YYYY-MM-DD" keys) touches the period. */
export function overlapsPeriod(fromKey: string, toKey: string, period: Period): boolean {
  const { start, end } = periodBounds(period);
  return fromKey <= end && (toKey || fromKey) >= start;
}

/** Steps a period by `by` of its own size (a range moves by its own length). */
export function shiftPeriod(period: Period, by: number): Period {
  const kind = periodKind(period);
  if (kind === "range") {
    const { start, end } = periodBounds(period);
    const len = daysBetween(start, end) + 1;
    return rangePeriod(addDays(start, len * by), addDays(end, len * by));
  }
  if (kind === "day") return addDays(period, by);
  const [y, m] = period.split("-").map(Number);
  if (!m) return String(y + by);
  const next = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}`;
}

function dayLabel(key: string, withYear = true) {
  const [y, m, d] = key.split("-").map(Number);
  return `${pad(d)} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}

/** "14 Nov 2026", "03 Nov – 12 Nov 2026", "01 Nov – 30 Nov 2026" or "Jan – Dec 2026". */
export function periodLabel(period: Period): string {
  const kind = periodKind(period);
  if (kind === "day") return dayLabel(period);
  if (kind === "range") {
    const { start, end } = periodBounds(period);
    if (start === end) return dayLabel(start);
    const sameYear = start.slice(0, 4) === end.slice(0, 4);
    return `${dayLabel(start, !sameYear)} – ${dayLabel(end)}`;
  }
  const [y, m] = period.split("-").map(Number);
  if (!m) return `Jan – Dec ${y}`;
  const { end } = periodBounds(period);
  return `01 ${MONTHS[m - 1]} – ${end.slice(8)} ${MONTHS[m - 1]} ${y}`;
}

// ── Picker panels ────────────────────────────────────────────────────────────

/** Monday-first grid of the month's day keys, with nulls for the leading blanks. */
function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0 = Sun
  const lead = (first + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => keyOf(year, month, i + 1)),
  ];
}

function PanelHeader({ title, onPrev, onNext }: { title: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous"
        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-xs font-semibold text-foreground">{title}</span>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next"
        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

interface DayGridProps {
  view: { y: number; m: number };
  setView: (v: { y: number; m: number }) => void;
  /** Highlighted span (a single day has start === end). */
  start?: string;
  end?: string;
  onPick: (key: string) => void;
  onHover?: (key: string | null) => void;
}

function DayGrid({ view, setView, start, end, onPick, onHover }: DayGridProps) {
  const today = todayKey();
  const step = (by: number) => {
    const d = new Date(Date.UTC(view.y, view.m + by, 1));
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };
  return (
    <div onMouseLeave={() => onHover?.(null)}>
      <PanelHeader title={`${MONTHS_LONG[view.m]} ${view.y}`} onPrev={() => step(-1)} onNext={() => step(1)} />
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="h-7 text-[10px] font-semibold uppercase text-muted-foreground flex items-center justify-center">
            {w}
          </div>
        ))}
        {monthGrid(view.y, view.m).map((key, i) => {
          if (!key) return <div key={`b${i}`} />;
          const isEdge = key === start || key === end;
          const inside = !!start && !!end && key > start && key < end;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(key)}
              onMouseEnter={() => onHover?.(key)}
              className={cn(
                "h-8 w-8 rounded-md text-xs transition-colors",
                isEdge
                  ? "bg-primary text-primary-foreground font-semibold"
                  : inside
                    ? "bg-primary/10 text-foreground"
                    : "text-foreground hover:bg-accent",
                key === today && !isEdge && "ring-1 ring-inset ring-primary font-semibold"
              )}
            >
              {Number(key.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CellGrid({
  items,
  selected,
  current,
  onPick,
}: {
  items: { value: string; label: string }[];
  selected?: string;
  current?: string;
  onPick: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          onClick={() => onPick(it.value)}
          className={cn(
            "h-9 rounded-md text-xs transition-colors",
            it.value === selected
              ? "bg-primary text-primary-foreground font-semibold"
              : "text-foreground hover:bg-accent",
            it.value === current && it.value !== selected && "ring-1 ring-inset ring-primary font-semibold"
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ── PeriodNav ────────────────────────────────────────────────────────────────

interface PeriodNavProps {
  value: Period;
  onChange: (next: Period) => void;
  /** Which kinds of period the picker offers (tabs). Default: all four. */
  modes?: PeriodMode[];
  /** Day values only: how many days the arrows move (7 for a week view). Default 1. */
  stepDays?: number;
  /** Replaces the default label (e.g. a week range). */
  label?: string;
  className?: string;
  /** Extra classes for the middle (date) button — e.g. a fixed width so the bar never shifts. */
  triggerClassName?: string;
}

/**
 * ‹ [period ▾] › — the arrows step the current period by its own size (a day / `stepDays`, a
 * range's length, a month or a year). The middle opens a picker for a date, a range, a month or
 * a year, limited to `modes`.
 */
export function PeriodNav({ value, onChange, modes = ALL_MODES, stepDays = 1, label, className, triggerClassName }: PeriodNavProps) {
  const kind = periodKind(value);
  const { start, end } = periodBounds(value);
  const step = kind === "day" ? stepDays : 1;
  const unit = kind === "day" ? (stepDays === 7 ? "week" : "day") : kind;

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PeriodMode>(modes.includes(kind) ? kind : modes[0]);
  const [view, setView] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
  const [yearView, setYearView] = useState(Number(start.slice(0, 4)));
  const [rangeFrom, setRangeFrom] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const openChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      // Re-centre the picker on the current value each time it opens.
      setTab(modes.includes(kind) ? kind : modes[0]);
      setView({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
      setYearView(Number(start.slice(0, 4)));
      setRangeFrom(null);
      setHover(null);
    }
  };

  const commit = (next: Period) => {
    onChange(next);
    setOpen(false);
  };

  const pickRangeDay = (key: string) => {
    if (!rangeFrom) {
      setRangeFrom(key);
      return;
    }
    commit(rangePeriod(rangeFrom, key));
  };

  // Range tab preview: the pending start plus the hovered day, else the current range value.
  const rangePreview = rangeFrom
    ? hover
      ? rangeFrom <= hover
        ? { start: rangeFrom, end: hover }
        : { start: hover, end: rangeFrom }
      : { start: rangeFrom, end: rangeFrom }
    : kind === "range" || kind === "day"
      ? { start, end }
      : { start: undefined, end: undefined };

  const today = todayKey();
  const thisMonth = today.slice(0, 7);
  const thisYear = today.slice(0, 4);
  const yearStart = yearView - (((yearView % 12) + 12) % 12);

  const navButton =
    "h-8 w-8 rounded-lg border-border/80 text-muted-foreground hover:text-foreground shrink-0";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Previous ${unit}`}
        onClick={() => onChange(shiftPeriod(value, -step))}
        className={navButton}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      <Popover open={open} onOpenChange={openChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-8 flex items-center gap-2 px-3 bg-background border border-border/80 rounded-lg text-xs font-medium text-foreground whitespace-nowrap hover:bg-accent transition-colors",
              triggerClassName
            )}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-left">{label ?? periodLabel(value)}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-[272px] p-3">
          {modes.length > 1 && (
            <div className="flex items-center p-0.5 mb-3 rounded-lg bg-muted">
              {modes.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setTab(m);
                    setRangeFrom(null);
                  }}
                  className={cn(
                    "flex-1 h-7 rounded-md text-xs font-semibold transition-colors",
                    tab === m ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {MODE_LABEL[m]}
                </button>
              ))}
            </div>
          )}

          {tab === "day" && (
            <>
              <DayGrid
                view={view}
                setView={setView}
                start={kind === "day" ? value : undefined}
                end={kind === "day" ? value : undefined}
                onPick={commit}
              />
              <div className="flex justify-end mt-2 pt-2 border-t border-border">
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => commit(today)}>
                  Today
                </Button>
              </div>
            </>
          )}

          {tab === "range" && (
            <>
              <DayGrid
                view={view}
                setView={setView}
                start={rangePreview.start}
                end={rangePreview.end}
                onPick={pickRangeDay}
                onHover={setHover}
              />
              <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border">
                <span className="text-[11px] text-muted-foreground">
                  {rangeFrom ? "Pick the end date" : "Pick the start date"}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => commit(rangePeriod(addDays(today, -6), today))}
                  >
                    Last 7d
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => commit(rangePeriod(addDays(today, -29), today))}
                  >
                    Last 30d
                  </Button>
                </div>
              </div>
            </>
          )}

          {tab === "month" && (
            <>
              <PanelHeader
                title={String(yearView)}
                onPrev={() => setYearView(yearView - 1)}
                onNext={() => setYearView(yearView + 1)}
              />
              <CellGrid
                items={MONTHS.map((mLabel, i) => ({ value: `${yearView}-${pad(i + 1)}`, label: mLabel }))}
                selected={kind === "month" ? value : undefined}
                current={thisMonth}
                onPick={commit}
              />
              <div className="flex justify-end mt-2 pt-2 border-t border-border">
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => commit(thisMonth)}>
                  This month
                </Button>
              </div>
            </>
          )}

          {tab === "year" && (
            <>
              <PanelHeader
                title={`${yearStart} – ${yearStart + 11}`}
                onPrev={() => setYearView(yearView - 12)}
                onNext={() => setYearView(yearView + 12)}
              />
              <CellGrid
                items={Array.from({ length: 12 }, (_, i) => ({ value: String(yearStart + i), label: String(yearStart + i) }))}
                selected={kind === "year" ? value : undefined}
                current={thisYear}
                onPick={commit}
              />
              <div className="flex justify-end mt-2 pt-2 border-t border-border">
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => commit(thisYear)}>
                  This year
                </Button>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Next ${unit}`}
        onClick={() => onChange(shiftPeriod(value, step))}
        className={navButton}
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
