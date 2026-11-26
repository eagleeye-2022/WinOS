"use client";

import { useEffect, useRef, useState } from "react";
import { Repeat, ChevronDown, ChevronUp, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildPresetOptions,
  describeRule,
  matchPresetKey,
  localDateInputValue,
  localWeekday,
  type RecurrenceRule,
  type Weekday,
} from "@/features/calendar/recurrence";

type Props = {
  value: RecurrenceRule | null;
  onChange: (rule: RecurrenceRule | null) => void;
  start: Date;
  /** "dropdown" renders a trigger button + menu; "inline" renders the option list directly (e.g. inside a modal). */
  variant?: "dropdown" | "inline";
};

const ALLOWED_KEYS = new Set(["none", "daily", "weekly", "monthly_date", "custom"]);

const WEEKDAY_CHIPS: { code: Weekday; label: string }[] = [
  { code: "SU", label: "S" },
  { code: "MO", label: "M" },
  { code: "TU", label: "T" },
  { code: "WE", label: "W" },
  { code: "TH", label: "T" },
  { code: "FR", label: "F" },
  { code: "SA", label: "S" },
];

type Tab = "DAILY" | "WEEKLY" | "MONTHLY";
const TABS: { key: Tab; label: string }[] = [
  { key: "DAILY", label: "Daily" },
  { key: "WEEKLY", label: "Weekly" },
  { key: "MONTHLY", label: "Monthly" },
];

export function DsmRecurrencePicker({
  value,
  onChange,
  start,
  variant = "dropdown",
}: Props) {
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

  const options = buildPresetOptions(start).filter((opt) => ALLOWED_KEYS.has(opt.key));
  const rawKey = matchPresetKey(value, start);
  const selectedKey = customOpen
    ? "custom"
    : ALLOWED_KEYS.has(rawKey)
      ? rawKey
      : "custom";

  const handleSelect = (opt: (typeof options)[number]) => {
    if (opt.key === "custom") {
      setCustomOpen(true);
      setOpen(false);
      return;
    }
    onChange(opt.rule);
    setOpen(false);
  };

  if (variant === "inline") {
    return (
      <div className="space-y-2">
        {!customOpen ? (
          <div className="overflow-hidden rounded-lg border border-border bg-background divide-y divide-border/50">
            {options.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleSelect(opt)}
                className={cn(
                  "flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm transition-colors cursor-pointer",
                  selectedKey === opt.key
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-accent"
                )}
              >
                <span>{opt.label}</span>
                {selectedKey === opt.key && <Check size={14} />}
              </button>
            ))}
          </div>
        ) : (
          <DsmCustomRecurrencePanel
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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-[210px] items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all cursor-pointer"
      >
        <Repeat size={13} className="shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left truncate">{describeRule(value, start)}</span>
        {open ? (
          <ChevronUp size={13} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={13} className="text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleSelect(opt)}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors cursor-pointer",
                selectedKey === opt.key
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-accent"
              )}
            >
              <span>{opt.label}</span>
              {selectedKey === opt.key && <Check size={13} />}
            </button>
          ))}
        </div>
      )}

      {customOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCustomOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border bg-card p-4 text-card-foreground shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <DsmCustomRecurrencePanel
              start={start}
              initial={value}
              onCancel={() => setCustomOpen(false)}
              onSave={(rule) => {
                onChange(rule);
                setCustomOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DsmCustomRecurrencePanel({
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

  const initialTab: Tab =
    initial?.freq === "WEEKLY" || initial?.freq === "MONTHLY" ? initial.freq : "DAILY";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [interval, setInterval] = useState(initial?.interval ?? 1);
  const [byDay, setByDay] = useState<Weekday[]>(
    initial?.freq === "WEEKLY" && initial.byDay && initial.byDay.length > 0
      ? initial.byDay
      : [startWeekday]
  );
  const [ends, setEnds] = useState<"never" | "on">(initial?.until ? "on" : "never");
  const [untilDate, setUntilDate] = useState(initial?.until ?? startDateStr);

  const toggleDay = (day: Weekday) => {
    setByDay((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = () => {
    const clampedInterval = Math.max(1, Math.floor(interval) || 1);
    const until = ends === "on" ? untilDate || startDateStr : null;
    if (tab === "DAILY") {
      onSave({ freq: "DAILY", interval: clampedInterval, until });
    } else if (tab === "WEEKLY") {
      onSave({
        freq: "WEEKLY",
        interval: clampedInterval,
        byDay: byDay.length > 0 ? byDay : [startWeekday],
        until,
      });
    } else {
      onSave({ freq: "MONTHLY", interval: clampedInterval, monthlyMode: "DATE", until });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Custom Recurrence</h3>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer",
              tab === t.key
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Repeat every</span>
        <input
          type="number"
          min={1}
          max={99}
          value={interval}
          onChange={(e) => setInterval(Math.max(1, Number(e.target.value) || 1))}
          className="w-16 rounded-md border bg-background px-2 py-1 text-center text-xs font-medium outline-none focus:border-primary"
        />
        <span className="text-muted-foreground">
          {tab === "DAILY" ? "day(s)" : tab === "WEEKLY" ? "week(s)" : "month(s)"}
        </span>
      </div>

      {tab === "WEEKLY" && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Repeat on</p>
          <div className="flex items-center gap-1.5">
            {WEEKDAY_CHIPS.map((d) => {
              const active = byDay.includes(d.code);
              return (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => toggleDay(d.code)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors cursor-pointer",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Ends</p>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              checked={ends === "never"}
              onChange={() => setEnds("never")}
            />
            <span>Never</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              checked={ends === "on"}
              onChange={() => setEnds("on")}
            />
            <span>On</span>
          </label>
          {ends === "on" && (
            <input
              type="date"
              value={untilDate}
              min={startDateStr}
              onChange={(e) => setUntilDate(e.target.value)}
              className="rounded-md border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
