import { AlertTriangle, CheckCircle2, Circle, Clock, Link2Off } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEffortMinutes } from "../utils";
import { TaskInfoLink } from "@/components/shared/task-table-parts";
import { projectTaskHref } from "@/lib/project-task-href";
import type { YesterdayTaskItem } from "../queries";

/**
 * Read-only "What Did You Complete Yesterday?" list: each of yesterday's planned tasks with its
 * done state (unfinished ones are carried into today), the effort logged on it that day, and a
 * flag when a task is marked done but no effort was logged.
 */
export function YesterdayTaskList({ tasks }: { tasks: YesterdayTaskItem[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground/60">No Entries for Yesterday.</p>;
  }

  const doneCount = tasks.filter((t) => t.isCompleted).length;
  const totalMinutes = tasks.reduce((sum, t) => sum + (t.loggedMinutes ?? 0), 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-semibold">
        <span className="rounded-full bg-success/10 px-2 py-0.5 text-success">
          {doneCount}/{tasks.length} done
        </span>
        {totalMinutes > 0 && (
          <span className="rounded-full bg-info/10 px-2 py-0.5 text-info">{formatEffortMinutes(totalMinutes)} logged</span>
        )}
      </div>

      {tasks.map((t) => (
        <div key={t.id} className="flex items-center gap-2.5 text-sm">
          {t.isCompleted ? (
            <CheckCircle2 size={18} className="shrink-0 text-primary dark:text-[#3B82F6]" />
          ) : (
            <Circle size={18} className="shrink-0 text-muted-foreground/50" />
          )}
          {t.code && (
            <span className="shrink-0 rounded-md border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
              {t.code}
            </span>
          )}
          {t.code && t.taskProjectId && (
            <TaskInfoLink href={projectTaskHref(t.taskProjectId, t.code)!} code={t.code} />
          )}
          <span className={cn("min-w-0 flex-1", !t.isCompleted && "text-muted-foreground")}>{t.text}</span>

          {!t.isCompleted && (
            <span
              className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400"
              title="Not done yesterday — carried into today's tasks"
            >
              Carried
            </span>
          )}
          {t.loggedMinutes !== null && t.loggedMinutes > 0 && (
            <span
              className="flex shrink-0 items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-[11px] font-semibold text-info"
              title="Effort logged on this task that day"
            >
              <Clock size={11} /> {formatEffortMinutes(t.loggedMinutes)}
            </span>
          )}
          {t.isCompleted && t.loggedMinutes === null && (
            <span
              className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
              title="Not linked to a project task, so effort can't be tracked. Pick Select Project → Task when you add it."
            >
              <Link2Off size={11} /> Not linked
            </span>
          )}
          {t.isCompleted && t.loggedMinutes === 0 && (
            <span
              className="flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning"
              title="Marked done, but no effort was logged on this task that day"
            >
              <AlertTriangle size={11} /> No effort logged
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
