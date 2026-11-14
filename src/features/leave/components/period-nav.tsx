"use client";

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A calendar month ("YYYY-MM") or a whole year ("YYYY"). */
export type Period = string;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** This month ("YYYY-MM") or this year ("YYYY"), in the browser's time zone. */
export function currentPeriod(mode: "month" | "year"): Period {
  const now = new Date();
  return mode === "year" ? String(now.getFullYear()) : `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** First and last "YYYY-MM-DD" of a period. */
export function periodBounds(period: Period): { start: string; end: string } {
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

function shift(period: Period, by: number): Period {
  const [y, m] = period.split("-").map(Number);
  if (!m) return String(y + by);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** "01 Nov – 30 Nov 2026" or "Jan – Dec 2026". */
export function periodLabel(period: Period): string {
  const [y, m] = period.split("-").map(Number);
  if (!m) return `Jan – Dec ${y}`;
  const { end } = periodBounds(period);
  return `01 ${MONTHS[m - 1]} – ${end.slice(8)} ${MONTHS[m - 1]} ${y}`;
}

interface PeriodNavProps {
  value: Period;
  onChange: (next: Period) => void;
}

/** ‹ [date range ▾] › — arrows step by a month (or year); the middle opens the browser's picker. */
export function PeriodNav({ value, onChange }: PeriodNavProps) {
  const isYear = !value.includes("-");
  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={isYear ? "Previous year" : "Previous month"}
        onClick={() => onChange(shift(value, -1))}
        className="h-8 w-8 rounded-lg border-border/80 text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <label className="relative flex items-center gap-2 px-3 py-1.5 bg-background border border-border/80 rounded-lg text-xs font-medium text-foreground cursor-pointer whitespace-nowrap">
        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
        <span>{periodLabel(value)}</span>
        {isYear ? (
          <select
            aria-label="Year"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          >
            {Array.from({ length: 7 }, (_, i) => Number(value) - 3 + i).map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="month"
            aria-label="Month"
            value={value}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        )}
      </label>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={isYear ? "Next year" : "Next month"}
        onClick={() => onChange(shift(value, 1))}
        className="h-8 w-8 rounded-lg border-border/80 text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
