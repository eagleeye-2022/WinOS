"use client";

import { useEffect, useRef, useState } from "react";
import { Repeat, ChevronDown, ChevronUp, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildPresetOptions,
  describeRule,
  matchPresetKey,
  serializeRule,
  localDateInputValue,
  localWeekday,
  type RecurrenceRule,
  type Weekday,
} from "../recurrence";

type Props = {
  value: RecurrenceRule | null;
  onChange: (rule: RecurrenceRule | null) => void;
  /** The event's start date — recurrence is always anchored to it (weekday, day-of-month, etc). */
  start: Date;
};

const WEEKDAY_CHIPS: { code: Weekday; label: string }[] = [
  { code: "SU", label: "S" },
  { code: "MO", label: "M" },
  { code: "TU", label: "T" },
  { code: "WE", label: "W" },
  { code: "TH", label: "T" },
  { code: "FR", label: "F" },
  { code: "SA", label: "S" },
];

export function RecurrencePicker({ value, onChange, start }: Props) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const options = buildPresetOptions(start);
  const selectedKey = customOpen ? "custom" : matchPresetKey(value, start);

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-foreground">Recurrence</label>

      <input type="hidden" name="recurrenceRule" value={serializeRule(value) ?? ""} />

      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        >
          <Repeat size={14} className="shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left">{describeRule(value, start)}</span>
          {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </button>

        {open && (
          <div className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
            {options.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  if (opt.key === "custom") {
                    setCustomOpen(true);
                    setOpen(false);
                    return;
                  }
                  onChange(opt.rule);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3.5 py-2 text-left text-sm transition-colors",
                  selectedKey === opt.key ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-accent",
                )}
              >
                {opt.label}
                {selectedKey === opt.key && <Check size={13} />}
              </button>
            ))}
          </div>
        )}
      </div>

      {customOpen && (
        <CustomRecurrenceDialog
          start={start}
          initial={value}
          onCancel={() => setCustomOpen(false)}
          onSave={(rule) => {
            onChange(rule);
            setCustomOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ── Custom recurrence dialog ────────────────────────────────────────────────

type Tab = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
const TABS: { key: Tab; label: string }[] = [
  { key: "DAILY", label: "Day" },
  { key: "WEEKLY", label: "Week" },
  { key: "MONTHLY", label: "Month" },
  { key: "YEARLY", label: "Year" },
];

function CustomRecurrenceDialog({
  start,
  initial,
  onCancel,
  onSave,
}: {
  start: Date;
  initial: RecurrenceRule | null;
  onCancel: () => void;
  onSave: (rule: RecurrenceRule) => void;
}) {
  const startWeekday = localWeekday(start);
  const startDateStr = localDateInputValue(start);

  const [tab, setTab] = useState<Tab>(initial?.freq ?? "DAILY");
  const [interval, setInterval] = useState(initial?.interval ?? 1);
  const [weekdaysOnly, setWeekdaysOnly] = useState(
    initial?.freq === "WEEKLY" && initial.interval === 1 &&
    initial.byDay?.length === 5 && ["MO", "TU", "WE", "TH", "FR"].every((d) => initial.byDay!.includes(d as Weekday)),
  );
  const [byDay, setByDay] = useState<Weekday[]>(
    initial?.freq === "WEEKLY" && initial.byDay && initial.byDay.length > 0 ? initial.byDay : [startWeekday],
  );
  const [monthlyMode, setMonthlyMode] = useState<"DATE" | "DAY">(
    initial?.freq === "MONTHLY" ? (initial.monthlyMode ?? "DATE") : "DATE",
  );
  const [ends, setEnds] = useState<"never" | "on">(initial?.until ? "on" : "never");
  const [untilDate, setUntilDate] = useState(initial?.until ?? startDateStr);

  function toggleDay(day: Weekday) {
    setByDay((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function handleSave() {
    const clampedInterval = Math.max(1, Math.floor(interval) || 1);
    const until = ends === "on" ? (untilDate || startDateStr) : null;

    let rule: RecurrenceRule;
    if (tab === "DAILY" && weekdaysOnly) {
      rule = { freq: "WEEKLY", interval: 1, byDay: ["MO", "TU", "WE", "TH", "FR"], until };
    } else if (tab === "WEEKLY") {
      rule = { freq: "WEEKLY", interval: clampedInterval, byDay: byDay.length > 0 ? byDay : [startWeekday], until };
    } else if (tab === "MONTHLY") {
      rule = { freq: "MONTHLY", interval: clampedInterval, monthlyMode, until };
    } else if (tab === "YEARLY") {
      rule = { freq: "YEARLY", interval: clampedInterval, until };
    } else {
      rule = { freq: "DAILY", interval: clampedInterval, until };
    }
    onSave(rule);
  }

  const dayOfMonth = Number(startDateStr.split("-")[2]);
  const nthWeekdayLabel = describeRule({ freq: "MONTHLY", interval: 1, monthlyMode: "DAY" }, start).replace("Monthly on the ", "");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Custom recurrence</span>
          <button type="button" onClick={onCancel} className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          {/* Tabs */}
          <div className="grid grid-cols-4 gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                  tab === t.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground">Repeat on</p>

            {tab === "DAILY" && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={!weekdaysOnly} onChange={() => setWeekdaysOnly(false)} className="text-primary" />
                  <span>Every</span>
                  <input
                    type="number"
                    min={1}
                    value={interval}
                    onChange={(e) => { setInterval(Number(e.target.value)); setWeekdaysOnly(false); }}
                    className="w-14 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:border-primary"
                  />
                  <span>day(s)</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={weekdaysOnly} onChange={() => setWeekdaysOnly(true)} className="text-primary" />
                  <span>Week days only</span>
                </label>
              </div>
            )}

            {tab === "WEEKLY" && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <span>Every</span>
                  <input
                    type="number"
                    min={1}
                    value={interval}
                    onChange={(e) => setInterval(Number(e.target.value))}
                    className="w-14 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:border-primary"
                  />
                  <span>week(s) on</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {WEEKDAY_CHIPS.map((w) => (
                    <button
                      key={w.code}
                      type="button"
                      onClick={() => toggleDay(w.code)}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                        byDay.includes(w.code) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === "MONTHLY" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span>Every</span>
                  <input
                    type="number"
                    min={1}
                    value={interval}
                    onChange={(e) => setInterval(Number(e.target.value))}
                    className="w-14 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:border-primary"
                  />
                  <span>month(s)</span>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={monthlyMode === "DATE"} onChange={() => setMonthlyMode("DATE")} className="text-primary" />
                  <span>On day {dayOfMonth}</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={monthlyMode === "DAY"} onChange={() => setMonthlyMode("DAY")} className="text-primary" />
                  <span className="capitalize">On the {nthWeekdayLabel}</span>
                </label>
              </div>
            )}

            {tab === "YEARLY" && (
              <div className="flex items-center gap-2 text-sm">
                <span>Every</span>
                <input
                  type="number"
                  min={1}
                  value={interval}
                  onChange={(e) => setInterval(Number(e.target.value))}
                  className="w-14 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:border-primary"
                />
                <span>
                  year(s) on{" "}
                  {new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(start)}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold text-foreground">Ends</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={ends === "never"} onChange={() => setEnds("never")} className="text-primary" />
              <span>Never</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={ends === "on"} onChange={() => setEnds("on")} className="text-primary" />
              <span>On</span>
              <input
                type="date"
                value={untilDate}
                min={startDateStr}
                onChange={(e) => { setUntilDate(e.target.value); setEnds("on"); }}
                disabled={ends !== "on"}
                className="rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:border-primary disabled:opacity-50"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
