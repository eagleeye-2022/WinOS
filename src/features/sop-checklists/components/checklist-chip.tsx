import { cn } from "@/lib/utils";
import { SopIcon } from "@/components/shared/sop-icon";

/**
 * SOP checklist marker for task cards: green when an SOP checklist is aligned to the task (with
 * its "4/7" progress), red when none is aligned yet.
 */
export function ChecklistChip({ summary }: { summary?: { done: number; total: number; requiredOpen: number } }) {
  // A summary exists exactly when an SOP checklist is attached — even one with no steps yet.
  const aligned = !!summary;
  const hasSteps = aligned && summary.total > 0;
  return (
    <span
      className={cn(
        "flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11px] font-semibold tabular-nums",
        aligned
          ? "border-success/40 bg-success/10 text-success"
          : "border-destructive/40 bg-destructive/10 text-destructive"
      )}
      title={
        hasSteps
          ? `SOP checklist aligned: ${summary.done} of ${summary.total} done` +
            (summary.requiredOpen > 0 ? ` · ${summary.requiredOpen} required still open` : "")
          : aligned
            ? "SOP checklist aligned (no steps yet)"
            : "No SOP checklist aligned to this task yet"
      }
    >
      <SopIcon checked={aligned} size={13} />
      {hasSteps && `${summary.done}/${summary.total}`}
    </span>
  );
}
