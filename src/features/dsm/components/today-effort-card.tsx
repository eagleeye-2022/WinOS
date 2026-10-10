import Link from "next/link";
import { ArrowUpRight, Timer } from "lucide-react";
import { formatEffortMinutes } from "../utils";
import { TaskInfoLink } from "@/components/shared/task-table-parts";
import { projectTaskHref } from "@/lib/project-task-href";
import type { DayEffortRow } from "../queries";

const MAX_ROWS = 6;

/**
 * End-of-day summary built from effort logs (instead of a DSR): total effort logged today and the
 * tasks it went to. Shown in the /dsm side panel.
 */
export function TodayEffortCard({ rows }: { rows: DayEffortRow[] }) {
  const total = rows.reduce((sum, r) => sum + r.minutes, 0);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-center gap-2">
        <Timer size={14} className="text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Today&apos;s Effort</span>
        <span className="ml-auto rounded-full bg-info/10 px-2 py-0.5 text-xs font-semibold text-info">
          {formatEffortMinutes(total)}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No effort logged yet today. Start a timer on a task to track it.</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            {formatEffortMinutes(total)} across {rows.length} task{rows.length !== 1 ? "s" : ""}
          </p>
          <ul className="flex flex-col gap-1.5">
            {rows.slice(0, MAX_ROWS).map((r) => (
              <li key={r.taskId} className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-foreground" title={r.task?.project?.name ?? undefined}>
                  {r.task?.code && <span className="mr-1 font-mono text-[11px] text-muted-foreground">{r.task.code}</span>}
                  {r.task?.title ?? "Task"}
                </span>
                {r.task?.code && r.task.project?.id && (
                  <TaskInfoLink href={projectTaskHref(r.task.project.id, r.task.code)!} code={r.task.code} />
                )}
                <span className="shrink-0 font-mono font-semibold text-foreground">{formatEffortMinutes(r.minutes)}</span>
              </li>
            ))}
          </ul>
          {rows.length > MAX_ROWS && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">+{rows.length - MAX_ROWS} more</p>
          )}
        </>
      )}

      <Link href="/projects/time-tracker" className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
        View Effort Logs <ArrowUpRight size={12} />
      </Link>
    </div>
  );
}
