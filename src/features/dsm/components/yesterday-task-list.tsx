"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Clock, Link2Off, Loader2, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/toast";
import { effortStartMinutes, formatEffortMinutes, formatEffortSpan } from "../utils";
import { TaskCodeChip, TaskRowCard, TaskRowCardFooter } from "@/components/shared/task-table-parts";
import { projectTaskHref } from "@/lib/project-task-href";
import { shortProjectName } from "@/features/projects/utils/project-name";
import { setLoggedTaskDoneAction } from "../actions/set-logged-task-done";
import { showChecklistGate } from "@/features/sop-checklists/components/checklist-gate";
import type { YesterdayLoggedTask, YesterdayTaskItem } from "../queries";

/**
 * "What Did You Do <previous DSM day>?" — one list: that day's planned DSM tasks (read-only done
 * state; unfinished ones are carried into today) followed by every other task time was logged on
 * that day (WhyFi School, Srijan, DSM / DSMA / DSMB, Internal Meetings…). Those extra rows can be
 * ticked: Done / back to In Progress. Each row shows its effort time (first start – last stop) and
 * hours; counts and the logged total cover both.
 */

/** "🕘 10:05 AM – 11:30 AM" — when the task was worked on that day. */
function EffortSpanChip({ from, to }: { from: string | null; to: string | null }) {
  const span = formatEffortSpan(from, to);
  if (!span) return null;
  return (
    <span
      className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground"
      title="Effort time — first start to last stop that day"
    >
      <Timer size={11} /> {span}
    </span>
  );
}

/** "🕓 1h 20m" — effort logged on the task that day. */
function LoggedMinutesChip({ minutes }: { minutes: number }) {
  return (
    <span
      className="flex shrink-0 items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-xs font-semibold text-info"
      title="Effort logged on this task that day"
    >
      <Clock size={11} /> {formatEffortMinutes(minutes)}
    </span>
  );
}

/** "PRIORITY: P1" — read-only, coloured like the priority picker on the "What Will You Do Today?" rows. */
function PriorityChip({ priority }: { priority: string | null }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Priority:</span>
      <span
        className={cn(
          "rounded-lg border px-2.5 py-0.5 text-xs font-bold",
          priority === "P1" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          priority === "P2" && "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
          priority === "P3" && "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
          priority && !["P1", "P2", "P3"].includes(priority) && "border-primary/40 bg-primary/10 text-primary",
          !priority && "border-border font-normal text-muted-foreground"
        )}
      >
        {priority || "—"}
      </span>
    </span>
  );
}

export function YesterdayTaskList({
  tasks,
  loggedTasks = [],
}: {
  tasks: YesterdayTaskItem[];
  loggedTasks?: YesterdayLoggedTask[];
}) {
  // Done state of the logged rows, so a tick shows at once and is undone if the save is refused.
  const [loggedDone, setLoggedDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(loggedTasks.map((t) => [t.taskId, t.isDone]))
  );
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (tasks.length === 0 && loggedTasks.length === 0) {
    return <p className="text-sm text-muted-foreground/60">No Entries for the Previous Day.</p>;
  }

  const isLoggedDone = (t: YesterdayLoggedTask) => loggedDone[t.taskId] ?? t.isDone;
  const totalCount = tasks.length + loggedTasks.length;
  const doneCount = tasks.filter((t) => t.isCompleted).length + loggedTasks.filter(isLoggedDone).length;
  const totalMinutes =
    tasks.reduce((sum, t) => sum + (t.loggedMinutes ?? 0), 0) + loggedTasks.reduce((sum, t) => sum + t.minutes, 0);

  const toggleLogged = async (t: YesterdayLoggedTask) => {
    if (pendingId) return;
    const next = !isLoggedDone(t);
    setLoggedDone((prev) => ({ ...prev, [t.taskId]: next }));
    setPendingId(t.taskId);
    try {
      const res = await setLoggedTaskDoneAction(t.taskId, next);
      if (!res.success) {
        setLoggedDone((prev) => ({ ...prev, [t.taskId]: !next }));
        if (res.checklistBlock) {
          showChecklistGate({
            ...res.checklistBlock,
            status: "Done",
            onForced: () => setLoggedDone((prev) => ({ ...prev, [t.taskId]: true })),
          });
        } else {
          toast.error(res.error || "Couldn't update the task");
        }
      } else {
        toast.success(next ? `${t.code} marked Done` : `${t.code} moved back to In Progress`);
      }
    } catch {
      setLoggedDone((prev) => ({ ...prev, [t.taskId]: !next }));
      toast.error("Couldn't update the task");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-semibold">
        <span className="rounded-full bg-success/10 px-2 py-0.5 text-success">
          {doneCount}/{totalCount} done
        </span>
        {totalMinutes > 0 && (
          <span className="rounded-full bg-info/10 px-2 py-0.5 text-info">{formatEffortMinutes(totalMinutes)} logged</span>
        )}
      </div>

      {/* DSM tasks and the other tasks time was logged on that day, as one list, by Effort Time —
          earliest start first; rows without an effort time keep their order at the bottom. Each row
          is the same card as the "What Will You Do Today?" rows. */}
      <div className="flex flex-col gap-3">
      {[
        ...tasks.map((t) => ({
          start: effortStartMinutes(t.effortFrom),
          render: (label: string) => {
            const hasMinutes = t.loggedMinutes !== null && t.loggedMinutes > 0;
            // Carried (not done), or done but Not linked / No effort logged.
            const hasBadges = !t.isCompleted || t.loggedMinutes === null || t.loggedMinutes === 0;
            return (
          <TaskRowCard key={t.id} label={label}>
            {/* Line 1: Done tick + Task ID (Code Chip) + Text */}
            <div className="flex w-full items-center gap-2 text-sm">
              {t.isCompleted ? (
                <CheckCircle2 size={18} className="shrink-0 text-primary" />
              ) : (
                <Circle size={18} className="shrink-0 text-muted-foreground/50" />
              )}
              {t.code && (
                <TaskCodeChip code={t.code} href={t.taskProjectId ? projectTaskHref(t.taskProjectId, t.code) : null} />
              )}
              <span className={cn("min-w-0 flex-1", !t.isCompleted && "text-muted-foreground")}>{t.text}</span>
            </div>

            {/* Line 2: status badges */}
            {hasBadges && (
              <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                {!t.isCompleted && (
                  <span
                    className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400"
                    title="Not done yesterday — carried into today's tasks"
                  >
                    Carried
                  </span>
                )}
                {t.isCompleted && t.loggedMinutes === null && (
                  <span
                    className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                    title="Not linked to a project task, so effort can't be tracked. Pick Select Project → Task when you add it."
                  >
                    <Link2Off size={11} /> Not linked
                  </span>
                )}
                {t.isCompleted && t.loggedMinutes === 0 && (
                  <span
                    className="flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning"
                    title="Marked done, but no effort was logged on this task that day"
                  >
                    <AlertTriangle size={11} /> No effort logged
                  </span>
                )}
              </div>
            )}

            {/* Line 3: Priority + Effort time on left, time logged on right */}
            <TaskRowCardFooter
              left={
                <div className="flex flex-wrap items-center gap-3">
                  <PriorityChip priority={t.priority} />
                  <EffortSpanChip from={t.effortFrom} to={t.effortTo} />
                </div>
              }
              right={hasMinutes && <LoggedMinutesChip minutes={t.loggedMinutes!} />}
            />

          </TaskRowCard>
            );
          },
        })),

      // Other tasks time was logged on that day — tick = Done, untick = In Progress.
        ...loggedTasks.map((t) => {
        const done = isLoggedDone(t);
        const href = projectTaskHref(t.projectId, t.code);
        return {
          start: effortStartMinutes(t.effortFrom),
          render: (label: string) => (
          <TaskRowCard key={t.taskId} label={label}>
            {/* Line 1: Done tick (toggle) + Task ID (Code Chip) + Text */}
            <div className="flex w-full items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => toggleLogged(t)}
                disabled={!!pendingId}
                title={done ? "Mark as not done (In Progress)" : "Mark as done"}
                aria-label={done ? `Mark ${t.code} as not done` : `Mark ${t.code} as done`}
                className="shrink-0 cursor-pointer rounded-full transition-transform hover:scale-110 disabled:cursor-wait"
              >
                {pendingId === t.taskId ? (
                  <Loader2 size={18} className="animate-spin text-primary" />
                ) : done ? (
                  <CheckCircle2 size={18} className="text-primary" />
                ) : (
                  <Circle size={18} className="text-muted-foreground/50" />
                )}
              </button>
              <TaskCodeChip code={t.code} title={t.title} href={href} />
              <span className={cn("min-w-0 flex-1", !done && "text-muted-foreground")}>{t.title}</span>
            </div>

            {/* Line 2: Project + "Logged" badge */}
            <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
              <span
                title={t.projectLabel}
                className="shrink-0 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {shortProjectName(t.projectLabel)}
              </span>
              <span
                className="shrink-0 rounded-full border border-info/30 bg-info/10 px-1.5 py-0.5 text-xs font-semibold text-info"
                title="Not in that day's DSM — time was logged on it (timer or effort log)"
              >
                Logged
              </span>
            </div>

            {/* Line 3: Effort time on left, time logged on right */}
            <TaskRowCardFooter
              left={<EffortSpanChip from={t.effortFrom} to={t.effortTo} />}
              right={<LoggedMinutesChip minutes={t.minutes} />}
            />
          </TaskRowCard>
          ),
        };
      }),
      ]
        .sort((a, b) => a.start - b.start)
        .map((r, pos) => r.render(`T${pos + 1}`))}
      </div>
    </div>
  );
}
