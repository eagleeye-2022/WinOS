import { ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compact "☑ 4/7" SOP checklist progress for task cards; amber while steps are open (the task can't close). */
export function ChecklistChip({
  summary,
  isClosed,
}: {
  summary: { done: number; total: number; requiredOpen: number };
  isClosed?: boolean;
}) {
  const complete = summary.done >= summary.total;
  const warn = !isClosed && !complete;
  return (
    <span
      className={cn(
        "flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11px] font-semibold tabular-nums",
        complete
          ? "border-success/40 bg-success/10 text-success"
          : warn
          ? "border-warning/40 bg-warning/10 text-warning"
          : "border-border/60 bg-muted/60 text-muted-foreground dark:border-white/10"
      )}
      title={
        `SOP checklist: ${summary.done} of ${summary.total} done` +
        (summary.requiredOpen > 0 ? ` · ${summary.requiredOpen} required still open` : "")
      }
    >
      <ListChecks size={12} />
      {summary.done}/{summary.total}
    </span>
  );
}
