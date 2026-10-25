"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Clock, Link2Off, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/toast";
import { formatEffortMinutes } from "../utils";
import { TaskInfoLink } from "@/components/shared/task-table-parts";
import { projectTaskHref } from "@/lib/project-task-href";
import { shortProjectName } from "@/features/projects/utils/project-name";
import { setLoggedTaskDoneAction } from "../actions/set-logged-task-done";
import { showChecklistGate } from "@/features/sop-checklists/components/checklist-gate";
import type { YesterdayLoggedTask, YesterdayTaskItem } from "../queries";

/**
 * "What Did You Do <previous DSM day>?" — one list: that day's planned DSM tasks (read-only done
 * state; unfinished ones are carried into today) followed by the other tasks time was logged on
 * that day (WhyFi School, tasks outside the DSM; DSM/DSR tasks are left out). Those extra rows can
 * be ticked: Done / back to In Progress. Counts and the logged total cover both.
 */
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

      {tasks.map((t) => (
        <div key={t.id} className="flex items-center gap-2.5 text-sm">
          {t.isCompleted ? (
            <CheckCircle2 size={18} className="shrink-0 text-primary" />
          ) : (
            <Circle size={18} className="shrink-0 text-muted-foreground/50" />
          )}
          {t.code && (
            <span className="shrink-0 rounded-md border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
              {t.code}
            </span>
          )}
          {t.code && t.taskProjectId && (
            <TaskInfoLink href={projectTaskHref(t.taskProjectId, t.code)!} code={t.code} />
          )}
          <span className={cn("min-w-0 flex-1", !t.isCompleted && "text-muted-foreground")}>{t.text}</span>

          {!t.isCompleted && (
            <span
              className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400"
              title="Not done yesterday — carried into today's tasks"
            >
              Carried
            </span>
          )}
          {t.loggedMinutes !== null && t.loggedMinutes > 0 && (
            <span
              className="flex shrink-0 items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-xs font-semibold text-info"
              title="Effort logged on this task that day"
            >
              <Clock size={11} /> {formatEffortMinutes(t.loggedMinutes)}
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
      ))}

      {/* Other tasks time was logged on that day — tick = Done, untick = In Progress. */}
      {loggedTasks.map((t) => {
        const done = isLoggedDone(t);
        const href = projectTaskHref(t.projectId, t.code);
        return (
          <div key={t.taskId} className="flex items-center gap-2.5 text-sm">
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
            <span className="shrink-0 rounded-md border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
              {t.code}
            </span>
            {href && <TaskInfoLink href={href} code={t.code} />}
            <span
              title={t.projectLabel}
              className="shrink-0 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {shortProjectName(t.projectLabel)}
            </span>
            <span className={cn("min-w-0 flex-1", !done && "text-muted-foreground")}>{t.title}</span>
            <span
              className="shrink-0 rounded-full border border-info/30 bg-info/10 px-1.5 py-0.5 text-xs font-semibold text-info"
              title="Not in that day's DSM — time was logged on it (timer or effort log)"
            >
              Logged
            </span>
            <span
              className="flex shrink-0 items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-xs font-semibold text-info"
              title="Effort logged on this task that day"
            >
              <Clock size={11} /> {formatEffortMinutes(t.minutes)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
