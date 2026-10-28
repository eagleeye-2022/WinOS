"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ListChecks, ListTree, Loader2, Timer, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEffortMinutes } from "@/features/dsm/utils";
import { getDsmTaskDetailAction, type DsmTaskDetail } from "@/features/dsm/actions/get-task-detail";

// One copy per task for the page's lifetime, so closing and reopening a row is instant.
const detailCache = new Map<string, DsmTaskDetail>();

/** ▸ / ▾ in a row's Action cell — opens the task's details under the row. */
export function TaskDetailToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={open ? "Hide task details" : "Show task details (time, logs, remarks)"}
      aria-label={open ? "Hide task details" : "Show task details"}
      aria-expanded={open}
      className={cn(
        "flex h-7 w-5 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-muted",
        open ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
    </button>
  );
}

const fmt = (mins: number) => formatEffortMinutes(mins) || "0m";

const formatLogDate = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? "Today" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

/** The full-width row under a task row: the task's time, recent logs with remarks, and status. */
export function TaskDetailRow({ taskId, colSpan }: { taskId: string; colSpan: number }) {
  return (
    <tr className="border-b">
      {/* Full table width — no side padding. */}
      <td colSpan={colSpan} className="px-0 pb-3 pt-1">
        <TaskDetailPanel taskId={taskId} />
      </td>
    </tr>
  );
}

function TaskDetailPanel({ taskId }: { taskId: string }) {
  const [detail, setDetail] = useState<DsmTaskDetail | null>(() => detailCache.get(taskId) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Refetch even when cached, so a log saved since then shows up (the cached copy shows meanwhile).
    getDsmTaskDetailAction(taskId)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          detailCache.set(taskId, res.detail);
          setDetail(res.detail);
        } else if (!detailCache.has(taskId)) {
          setError(res.error);
        }
      })
      .catch(() => {
        if (!cancelled && !detailCache.has(taskId)) setError("Couldn't load the task details.");
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (error) return <p className="py-2 text-xs italic text-muted-foreground">{error}</p>;
  if (!detail) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 size={13} className="animate-spin" /> Loading task details…
      </div>
    );
  }

  const billablePct = detail.totalMinutes > 0 ? Math.round((detail.billableMinutes / detail.totalMinutes) * 100) : 0;

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3 text-xs shadow-2xs">
      {/* Effort summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-semibold text-foreground">
          <Timer size={12} className="mr-1 inline text-info" />
          Total <span className="font-mono font-bold">{fmt(detail.totalMinutes)}</span>
        </span>
        {/* Same colours as the Effort Logs report: billable blue, non-billable amber. */}
        <span className="inline-flex items-center gap-1 text-info" title="Billable">
          <span className="h-2 w-2 rounded-full bg-info" />
          <span className="font-mono font-bold">{fmt(detail.billableMinutes)}</span>
        </span>
        <span className="inline-flex items-center gap-1 text-warning" title="Non-billable">
          <span className="h-2 w-2 rounded-full bg-warning" />
          <span className="font-mono font-bold">{fmt(detail.nonBillableMinutes)}</span>
        </span>
        <span className="text-muted-foreground">
          {detail.logCount} log{detail.logCount === 1 ? "" : "s"}
        </span>
      </div>
      {detail.totalMinutes > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-warning/70" title={`${billablePct}% billable`}>
            <div className="h-full bg-info" style={{ width: `${billablePct}%` }} />
          </div>
          <span className="shrink-0 font-mono text-[11px] text-info">{billablePct}%</span>
        </div>
      )}

      {/* Running now */}
      {detail.runningTimers.length > 0 && (
        <p className="flex items-center gap-1.5 rounded-md bg-sky-500/10 px-2 py-1 text-sky-700 dark:text-sky-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
          Timer running now:{" "}
          {detail.runningTimers
            .map((t) => `${t.userName} (since ${new Date(t.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })})`)
            .join(", ")}
        </p>
      )}

      {/* Recent time logs */}
      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Recent effort</p>
        {detail.recentLogs.length === 0 ? (
          <p className="italic text-muted-foreground">No time logged on this task yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {detail.recentLogs.map((l) => (
              <li
                key={l.id}
                className={cn(
                  // Billing shown by colour (Effort Logs report style): blue billable, amber non-billable.
                  "grid grid-cols-[minmax(90px,140px)_60px_minmax(120px,auto)_56px_1fr] items-center gap-2 border-l-2 px-2 py-1.5",
                  l.billable ? "border-l-info" : "border-l-warning"
                )}
                title={l.billable ? "Billable" : "Non-billable"}
              >
                <span className="truncate font-semibold text-foreground" title={l.userName}>
                  {l.userName}
                </span>
                <span className="text-muted-foreground">{formatLogDate(l.date)}</span>
                <span className="truncate font-mono text-muted-foreground">{l.timePeriod || "—"}</span>
                <span className={cn("font-mono font-bold", l.billable ? "text-info" : "text-warning")}>{fmt(l.minutes)}</span>
                <span className={cn("truncate", l.remarks ? "text-foreground/90" : "italic text-muted-foreground/60")} title={l.remarks}>
                  {l.remarks || "No remarks"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {detail.logCount > detail.recentLogs.length && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Showing the latest {detail.recentLogs.length} of {detail.logCount} logs — open the task (ⓘ) for all.
          </p>
        )}
      </div>

      {/* Quick facts */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
        <span>
          Status <b className="text-foreground">{detail.status}</b>
        </span>
        {detail.dueDate && (
          <span>
            Due <b className="text-foreground">{detail.dueDate}</b>
          </span>
        )}
        {detail.subtasks.total > 0 && (
          <span className="inline-flex items-center gap-1">
            <ListTree size={12} /> Subtasks <b className="text-foreground">{detail.subtasks.done}/{detail.subtasks.total}</b>
          </span>
        )}
        <span className={cn("inline-flex items-center gap-1", detail.sop.attached ? "text-success" : "text-destructive")}>
          <ListChecks size={12} />
          {detail.sop.attached ? (
            <>
              SOP <b>{detail.sop.done}/{detail.sop.total}</b>
            </>
          ) : (
            "No SOP"
          )}
        </span>
        {detail.owners.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Users size={12} /> <span className="text-foreground">{detail.owners.join(", ")}</span>
          </span>
        )}
      </div>
    </div>
  );
}
