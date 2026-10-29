"use client";

import { Fragment, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ListChecks,
  ListTree,
  Loader2,
  MessageSquare,
  Timer,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getAvatarColor, getInitials } from "@/lib/avatar";
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

const DAY_MS = 24 * 3600 * 1000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** "31/07/2027" (Zoho format) or "2027-07-31" → local date; null when unreadable. */
function parseDueDate(v: string): Date | null {
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const d = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : startOfDay(d);
}

/** Whole days the due date has passed (0 when not overdue). */
function daysOverdue(due: string | null, isDone: boolean): number {
  if (!due || isDone) return 0;
  const d = parseDueDate(due);
  if (!d) return 0;
  return Math.max(0, Math.round((startOfDay(new Date()).getTime() - d.getTime()) / DAY_MS));
}

/** "just now", "3h ago", "2 days ago". */
function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function Avatar({ name, size = "h-6 w-6 text-[10px]" }: { name: string; size?: string }) {
  return (
    <UserAvatar name={name} title={name} className={cn(size, "font-bold ring-2 ring-card", getAvatarColor(name))}>
      {getInitials(name)}
    </UserAvatar>
  );
}

/** Small uppercase heading over a block. */
function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{children}</p>;
}

/** "Worked by" — first avatars + count; click to open everyone's time as a borderless table. */
function WorkedBy({ contributors, totalMinutes }: { contributors: DsmTaskDetail["contributors"]; totalMinutes: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight size={14} className={cn("transition-transform", open && "rotate-90")} />
        Worked by
        <span className="flex -space-x-1.5">
          {contributors.slice(0, 5).map((c) => (
            <Avatar key={c.name} name={c.name} size="h-5 w-5 text-[9px]" />
          ))}
        </span>
        <span>
          {contributors.length} {contributors.length === 1 ? "person" : "people"}
        </span>
      </button>
      {open && (
        <table className="mt-1.5 w-full max-w-xl">
          <tbody>
            {contributors.map((c) => {
              const pct = totalMinutes > 0 ? Math.round((c.minutes / totalMinutes) * 100) : 0;
              return (
                <tr key={c.name}>
                  <td className="py-1 pr-3">
                    <span className="inline-flex items-center gap-1.5 text-foreground">
                      <Avatar name={c.name} size="h-5 w-5 text-[9px]" />
                      {c.name}
                    </span>
                  </td>
                  <td className="py-1 pr-3 text-right font-mono font-semibold text-foreground">{fmt(c.minutes)}</td>
                  <td className="w-16 py-1 text-right font-mono text-xs text-muted-foreground">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

const SUBTASK_STATUS_TONE: Record<string, string> = {
  "in progress": "text-info",
  "on hold": "text-warning",
  blocked: "text-destructive",
};

/**
 * "Subtasks 2/4" — click to open a bordered table of every subtask (any depth, indented): status,
 * owners, priority, due date, effort. Each row's ▸ opens that subtask's own detail panel below it.
 */
function SubtasksTable({ rows, done }: { rows: DsmTaskDetail["subtaskRows"]; done: number }) {
  const [open, setOpen] = useState(false);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight size={14} className={cn("transition-transform", open && "rotate-90")} />
        <ListTree size={14} /> Subtasks
        <b className={done === rows.length ? "text-success" : "text-foreground"}>
          {done}/{rows.length}
        </b>
      </button>
      {open && (
        <div className="mt-1.5 overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground">
                <th className="w-8 px-2 py-1.5" />
                <th className="border-l px-3 py-1.5 font-semibold">Task ID</th>
                <th className="w-full border-l px-3 py-1.5 font-semibold">Subtask</th>
                <th className="border-l px-3 py-1.5 font-semibold">Status</th>
                <th className="border-l px-3 py-1.5 font-semibold">Owner</th>
                <th className="border-l px-3 py-1.5 font-semibold">Priority</th>
                <th className="border-l px-3 py-1.5 font-semibold">Due Date</th>
                <th className="border-l px-3 py-1.5 font-semibold">Effort</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const rowOpen = openRowId === s.id;
                const overdue = daysOverdue(s.dueDate, s.done);
                return (
                  <Fragment key={s.id}>
                    <tr className="border-b last:border-b-0">
                      <td className="px-2 py-1.5">
                        <TaskDetailToggle open={rowOpen} onToggle={() => setOpenRowId(rowOpen ? null : s.id)} />
                      </td>
                      <td className="whitespace-nowrap border-l px-3 py-1.5 font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {s.code}
                      </td>
                      <td className="border-l px-3 py-1.5">
                        <span className="flex items-center gap-1.5" style={{ paddingLeft: s.depth * 16 }}>
                          {s.done ? (
                            <CheckCircle2 size={13} className="shrink-0 text-success" />
                          ) : (
                            <Circle size={13} className="shrink-0 text-muted-foreground/50" />
                          )}
                          <span className={cn(s.done ? "text-muted-foreground line-through" : "text-foreground")}>{s.title}</span>
                        </span>
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap border-l px-3 py-1.5 font-semibold",
                          s.done ? "text-success" : SUBTASK_STATUS_TONE[s.status.toLowerCase()] ?? "text-foreground"
                        )}
                      >
                        {s.status}
                      </td>
                      <td className="border-l px-3 py-1.5">
                        {s.owners.length === 0 ? (
                          <span className="italic text-muted-foreground">Unassigned</span>
                        ) : (
                          <span className="flex -space-x-1.5">
                            {s.owners.map((name) => (
                              <Avatar key={name} name={name} size="h-5 w-5 text-[9px]" />
                            ))}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap border-l px-3 py-1.5 text-muted-foreground">{s.priority ?? "—"}</td>
                      <td
                        className={cn(
                          "whitespace-nowrap border-l px-3 py-1.5",
                          overdue > 0 ? "font-semibold text-destructive" : "text-muted-foreground"
                        )}
                        title={overdue > 0 ? `${overdue} day${overdue === 1 ? "" : "s"} overdue` : undefined}
                      >
                        {s.dueDate ?? "—"}
                      </td>
                      <td className="whitespace-nowrap border-l px-3 py-1.5 font-mono font-semibold text-foreground">
                        {s.minutes > 0 ? fmt(s.minutes) : "—"}
                      </td>
                    </tr>
                    {rowOpen && (
                      <tr className="border-b last:border-b-0">
                        <td colSpan={8} className="bg-muted/20 p-2">
                          <TaskDetailPanel taskId={s.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

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

  if (error) return <p className="py-2 text-sm italic text-muted-foreground">{error}</p>;
  if (!detail) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" /> Loading task details…
      </div>
    );
  }

  const billablePct = detail.totalMinutes > 0 ? Math.round((detail.billableMinutes / detail.totalMinutes) * 100) : 0;
  const overdue = daysOverdue(detail.dueDate, detail.isDone);

  return (
    <div className="space-y-3.5 rounded-xl border bg-card p-4 text-[13px] shadow-2xs">
      {/* Effort summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-semibold text-foreground">
          <Timer size={14} className="mr-1 inline text-info" />
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
        <span className="text-muted-foreground" title="Logged on this task today, everyone">
          Today <b className="font-mono text-foreground">{fmt(detail.todayMinutes)}</b>
        </span>
        {/* Pending approvals — hidden for now.
        {detail.pendingApprovals > 0 && (
          <span className="inline-flex items-center gap-1 text-warning">
            <Hourglass size={12} /> {detail.pendingApprovals} pending approval
          </span>
        )} */}
      </div>
      {detail.totalMinutes > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-warning/70" title={`${billablePct}% billable`}>
            <div className="h-full bg-info" style={{ width: `${billablePct}%` }} />
          </div>
          <span className="shrink-0 font-mono text-xs text-info">{billablePct}%</span>
        </div>
      )}

      {/* Who worked on it — collapsed to a line of avatars, opens to a table */}
      {detail.contributors.length > 0 && (
        <WorkedBy contributors={detail.contributors} totalMinutes={detail.totalMinutes} />
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
        <Label>Recent effort</Label>
        {detail.recentLogs.length === 0 ? (
          <p className="italic text-muted-foreground">No time logged on this task yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground">
                  <th className="px-3 py-1.5 font-semibold">User</th>
                  <th className="border-l px-3 py-1.5 font-semibold">Date</th>
                  <th className="border-l px-3 py-1.5 font-semibold">Time</th>
                  <th className="border-l px-3 py-1.5 font-semibold">Effort</th>
                  <th className="w-full border-l px-3 py-1.5 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {detail.recentLogs.map((l) => (
                  // Billing shown by the duration's colour (Effort Logs report style): blue billable, amber non-billable.
                  <tr key={l.id} className="border-b last:border-b-0" title={l.billable ? "Billable" : "Non-billable"}>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                        <Avatar name={l.userName} size="h-5 w-5 text-[9px]" />
                        {l.userName}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-l px-3 py-1.5 text-muted-foreground">{formatLogDate(l.date)}</td>
                    <td className="whitespace-nowrap border-l px-3 py-1.5 font-mono text-muted-foreground">{l.timePeriod || "—"}</td>
                    <td
                      className={cn(
                        "whitespace-nowrap border-l px-3 py-1.5 font-mono font-bold",
                        l.billable ? "text-info" : "text-warning"
                      )}
                    >
                      {fmt(l.minutes)}
                    </td>
                    <td className={cn("border-l px-3 py-1.5", l.remarks ? "text-foreground/90" : "italic text-muted-foreground/60")}>
                      {l.remarks || "No remarks"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subtasks — collapsed; opens to a table, each row opens that subtask's own details */}
      {detail.subtaskRows.length > 0 && <SubtasksTable rows={detail.subtaskRows} done={detail.subtasks.done} />}

      {/* Latest comment */}
      {detail.latestComment && (
        <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-2.5 py-2">
          <MessageSquare size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
          <p className="min-w-0">
            <b className="text-foreground">{detail.latestComment.author}</b>{" "}
            <span className="text-xs text-muted-foreground">· {timeAgo(detail.latestComment.createdAt)}</span>
            <span className="block text-foreground/90">{detail.latestComment.text}</span>
          </p>
        </div>
      )}

      {/* Quick facts */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
        <span>
          Status <b className="text-foreground">{detail.status}</b>
        </span>
        {detail.dueDate && (
          <span className={cn("inline-flex items-center gap-1", overdue > 0 && "text-destructive")}>
            {overdue > 0 && <AlertTriangle size={13} />}
            Due <b className={overdue > 0 ? "text-destructive" : "text-foreground"}>{detail.dueDate}</b>
            {overdue > 0 && (
              <span className="font-semibold">
                · {overdue} day{overdue === 1 ? "" : "s"} overdue
              </span>
            )}
          </span>
        )}
        {detail.lastActivityAt && (
          <span>
            Last activity <b className="text-foreground">{timeAgo(detail.lastActivityAt)}</b>
          </span>
        )}
        {detail.subtasks.total > 0 && (
          <span className="inline-flex items-center gap-1">
            <ListTree size={13} /> Subtasks <b className="text-foreground">{detail.subtasks.done}/{detail.subtasks.total}</b>
          </span>
        )}
        <span className={cn("inline-flex items-center gap-1", detail.sop.attached ? "text-success" : "text-destructive")}>
          <ListChecks size={13} />
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
            <Users size={13} />
            <span className="flex -space-x-1.5">
              {detail.owners.map((name) => (
                <Avatar key={name} name={name} />
              ))}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
