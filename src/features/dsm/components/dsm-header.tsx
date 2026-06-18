import { formatDayHeader, formatFullDate, toUtcDate } from "../utils";
import type { EntryWithDetails } from "../queries";

type DsmHeaderProps = {
  entry: EntryWithDetails | null;
};

export function DsmHeader({ entry }: DsmHeaderProps) {
  const now = toUtcDate();
  const taskCount = entry?.tasks.filter((t) => t.kind === "TODAY").length ?? 0;
  const blockerCount = entry?.blockers.length ?? 0;
  const followUpCount = entry?.supportNeeds.length ?? 0;

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground">{formatDayHeader(now)}</p>
        <h1 className="text-3xl font-bold tracking-tight">{formatFullDate(now)}</h1>
      </div>

      <div className="mb-0.5 flex flex-wrap items-center gap-5">
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          Today
        </span>

        <div className="flex items-center gap-5">
          <div className="flex flex-col items-center text-center">
            <span className="text-base font-bold leading-none">{taskCount}</span>
            <span className="mt-0.5 text-[10px] text-muted-foreground">Tasks</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <span className={`text-base font-bold leading-none ${blockerCount > 0 ? "text-destructive" : ""}`}>
              {blockerCount}
            </span>
            <span className={`mt-0.5 text-[10px] ${blockerCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>
              Blockers
            </span>
          </div>
          <div className="flex flex-col items-center text-center">
            <span className="text-base font-bold leading-none">{followUpCount}</span>
            <span className="mt-0.5 text-[10px] text-muted-foreground">Follow-ups</span>
          </div>
        </div>
      </div>
    </div>
  );
}
