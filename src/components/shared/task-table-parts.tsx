"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Calendar, Clock, Timer, Filter, ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortFilterOption = { value: string; label: string };

/**
 * "Filter" button that opens a dropdown of sort options — clicking an option
 * immediately applies that sort and closes the menu (the caller owns the actual
 * sorting logic; this component is purely the trigger + menu UI).
 */
export function SortFilterButton({
  options,
  activeValue,
  onSelect,
  label = "Filter",
}: {
  options: SortFilterOption[];
  activeValue?: string;
  onSelect: (value: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const activeOption = options.find((o) => o.value === activeValue);
  const isActive = Boolean(activeOption && activeValue !== options[0]?.value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
          isActive
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
        )}
      >
        <Filter size={12} />
        {isActive ? activeOption!.label : label}
        <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border bg-card p-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onSelect(opt.value);
                setOpen(false);
              }}
              className={cn(
                "block w-full rounded px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent cursor-pointer",
                opt.value === activeValue ? "font-semibold text-primary" : "text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Expandable text component with "See more" / "See less" toggle. */
export function ExpandableTaskText({
  text,
  maxLength = 30,
  className,
}: {
  text: string;
  maxLength?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > maxLength;

  if (!isLong) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={cn("inline", className)}>
      <span>{expanded ? text : `${text.slice(0, maxLength)}...`}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((prev) => !prev);
        }}
        className="ml-1.5 inline-flex items-center text-xs font-semibold text-primary hover:underline cursor-pointer select-none"
      >
        {expanded ? "See less" : "See more"}
      </button>
    </span>
  );
}

/** ⓘ icon that opens a project task's page (same tab). */
export function TaskInfoLink({ href, code, className }: { href: string; code: string; className?: string }) {
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      title={`Open task ${code}`}
      aria-label={`Open task ${code}`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-primary",
        className
      )}
    >
      <Info size={13} />
    </Link>
  );
}

/** `[WIN-T101]`-style mono code chip for a linked project task; with `href`, followed by an ⓘ link to its page. */
export function TaskIdChip({ code, title, href }: { code: string; title?: string; href?: string | null }) {
  const chip = (
    <span
      title={title || code}
      className="rounded bg-primary/10 border border-primary/20 text-primary px-1.5 py-0.5 text-[11px] font-mono font-bold shrink-0 whitespace-nowrap cursor-default"
    >
      {code}
    </span>
  );
  if (!href) return chip;
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {chip}
      <TaskInfoLink href={href} code={code} />
    </span>
  );
}

/** Colored pill for a linked project's name. */
export function ProjectPill({ name }: { name: string }) {
  const displayName = name.length > 5 ? `${name.slice(0, 5)}.` : name;
  return (
    <span
      title={name}
      className="inline-flex shrink-0 items-center rounded-md border border-info/30 bg-info/10 px-2 py-0.5 text-xs font-medium text-info whitespace-nowrap"
    >
      {displayName}
    </span>
  );
}

/**
 * Due-date cell for a DSM task's own `dueDate` (set by the team member on the task,
 * not the linked project task's due date). Renders red when strictly in the past.
 */
export function DueDateCell({ dueDate }: { dueDate: Date | string | null | undefined }) {
  if (!dueDate) {
    return <span className="text-xs text-muted-foreground/60">—</span>;
  }
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) {
    return <span className="text-xs text-muted-foreground/60">—</span>;
  }
  const isOverdue = parsed.getTime() < new Date(new Date().toDateString()).getTime();
  return (
    <span className={cn(
      "flex items-center gap-1.5 whitespace-nowrap text-xs",
      isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
    )}>
      <Calendar size={12} />
      {formatDueDate(parsed)}
    </span>
  );
}

/** Day-first short due date, e.g. "30 Sep". */
export function formatDueDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(date));
}

/**
 * Due-date picker that displays "30 Sep" instead of the browser's locale format (dd-mm-yyyy).
 * The native date input sits invisibly on top of the label, so clicking still opens the
 * browser's own calendar and `name` still submits the "YYYY-MM-DD" value with the form.
 */
export function DueDateInput({
  value,
  onChange,
  name,
  disabled,
  placeholder = "Set date",
}: {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const hasValue = !!value && !Number.isNaN(new Date(value).getTime());
  return (
    <span className="relative inline-flex items-center">
      <span className={cn("whitespace-nowrap text-xs", hasValue ? "text-foreground" : "text-muted-foreground")}>
        {hasValue ? formatDueDate(value) : placeholder}
      </span>
      <input
        type="date"
        name={name}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {
            // showPicker throws if not triggered by a user gesture — the native click still works.
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed [color-scheme:light] dark:[color-scheme:dark]"
      />
    </span>
  );
}

/** Today's local calendar date as "YYYY-MM-DD" (the format DueDateInput uses). */
function todayDateValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** One-click "Today" shortcut that sets a DueDateInput's value to today's date. */
export function TodayDueButton({
  value,
  onChange,
  disabled,
}: {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const today = todayDateValue();
  const isToday = value === today;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(today)}
      aria-pressed={isToday}
      title="Set the due date to today"
      className={cn(
        "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        isToday
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
      )}
    >
      Today
    </button>
  );
}

/** Static, read-only `HH:MM:SS`-style time-tracked badge (for surfaces without a live timer). */
export function TimeTrackedBadge({ totalMinutes }: { totalMinutes: number }) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const label = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  const active = totalMinutes > 0;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 select-none pointer-events-none transition-all",
        active
          ? "border border-sky-500/40 bg-sky-500/10 dark:bg-sky-500/20 dark:border-sky-500/40"
          : "border border-border/60 bg-muted/60 dark:bg-[#121316] dark:border-white/10"
      )}
    >
      <Timer
        size={13}
        className={cn("shrink-0", active ? "text-sky-500 dark:text-sky-400" : "text-info")}
      />
      <span
        className={cn(
          "font-mono text-xs font-bold tracking-tight select-none cursor-default",
          active ? "text-sky-600 dark:text-sky-300" : "text-foreground dark:text-neutral-100"
        )}
      >
        {label}
      </span>
    </div>
  );
}

/** Shared priority badge for tables */
export function PriorityBadge({ priority }: { priority?: string | null }) {
  if (!priority) return <span className="text-xs text-muted-foreground/60">—</span>;
  const p = priority.toUpperCase();
  const isP1 = p === "P1" || p === "HIGH";
  const isP2 = p === "P2" || p === "MEDIUM";
  const isP3 = p === "P3" || p === "LOW";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold uppercase shrink-0 whitespace-nowrap border",
        isP1 && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        isP2 && "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
        isP3 && "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        !isP1 && !isP2 && !isP3 && "border-primary/30 bg-primary/10 text-primary"
      )}
    >
      {priority}
    </span>
  );
}

/** Formats a task's creation timestamp as e.g. "16 Sep 2026, 11:02 AM". */
export function formatCreatedAt(date: Date | string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(parsed);
}

/** Small "Created <date, time>" subtitle shown under a task's text. */
export function TaskCreatedAtLabel({ date }: { date: Date | string | null | undefined }) {
  if (!date) return null;
  return (
    <span className="mt-0.5 block text-[10px] text-muted-foreground/60 whitespace-nowrap">
      Created {formatCreatedAt(date)}
    </span>
  );
}

/** Shared table header row for the "Today's Task(s)" tables. */
export function TaskTableHead({
  withCheckbox,
  withAction,
  withProject = true,
  withTimeTracked = true,
}: {
  withCheckbox?: boolean;
  withAction?: boolean;
  withProject?: boolean;
  withTimeTracked?: boolean;
}) {
  return (
    <thead>
      <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {withCheckbox && <th className="w-8 pb-2.5 pr-2 font-semibold whitespace-nowrap"></th>}
        <th className="w-10 pb-2.5 pr-2 font-semibold whitespace-nowrap">#</th>
        {withProject && <th className="pb-2.5 pr-3 font-semibold whitespace-nowrap">Project</th>}
        {withProject && <th className="pb-2.5 pr-3 font-semibold whitespace-nowrap">Task ID</th>}
        <th className="pb-2.5 pr-3 font-semibold whitespace-nowrap">Task / Subtask</th>
        <th className="w-20 pb-2.5 pr-3 font-semibold whitespace-nowrap">Priority</th>
        <th className="pb-2.5 pr-3 font-semibold whitespace-nowrap">Due Date</th>
        {withTimeTracked && <th className="pb-2.5 pr-3 font-semibold whitespace-nowrap">Effort Logs</th>}
        {withAction && <th className="pb-2.5 pr-2 text-center font-semibold whitespace-nowrap w-24">Action</th>}
      </tr>
    </thead>
  );
}
