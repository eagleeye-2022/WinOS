"use client";

import { useState } from "react";
import { Calendar, Clock, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

/** Expandable text component with "See more" / "See less" toggle. */
export function ExpandableTaskText({
  text,
  maxLength = 60,
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

/** `[WIN-T101]`-style mono code chip for a linked project task. */
export function TaskIdChip({ code }: { code: string }) {
  return (
    <span className="rounded bg-primary/10 border border-primary/20 text-primary px-1.5 py-0.5 text-[11px] font-mono font-bold shrink-0 whitespace-nowrap">
      {code}
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
  const label = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed);
  return (
    <span className={cn(
      "flex items-center gap-1.5 whitespace-nowrap text-xs",
      isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
    )}>
      <Calendar size={12} />
      {label}
    </span>
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

/** Shared table header row for the "Today's Task(s)" tables. */
export function TaskTableHead({ withCheckbox, withAction }: { withCheckbox?: boolean; withAction?: boolean }) {
  return (
    <thead>
      <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {withCheckbox && <th className="w-8 pb-2.5 pr-2 font-semibold whitespace-nowrap"></th>}
        <th className="w-10 pb-2.5 pr-2 font-semibold whitespace-nowrap">#</th>
        <th className="pb-2.5 pr-3 font-semibold whitespace-nowrap">Project</th>
        <th className="pb-2.5 pr-3 font-semibold whitespace-nowrap">Task ID</th>
        <th className="pb-2.5 pr-3 font-semibold whitespace-nowrap">Task / Subtask</th>
        <th className="w-20 pb-2.5 pr-3 font-semibold whitespace-nowrap">Priority</th>
        <th className="pb-2.5 pr-3 font-semibold whitespace-nowrap">Due Date</th>
        <th className="pb-2.5 pr-3 font-semibold whitespace-nowrap">Time Tracked</th>
        {withAction && <th className="pb-2.5 pr-2 text-center font-semibold whitespace-nowrap w-24">Action</th>}
      </tr>
    </thead>
  );
}
