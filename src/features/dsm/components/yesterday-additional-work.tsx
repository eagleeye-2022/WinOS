"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { STICKY_PROJECT_COL_3, TASK_TABLE_SCROLL, TaskTableHead } from "@/components/shared/task-table-parts";

export type AdditionalWorkItem = { id: string; text: string; completed: boolean };

/** "—" for the columns additional work has no value for (project, task ID, priority…). */
export function AdditionalWorkDash() {
  return <span className="text-xs text-muted-foreground/60">—</span>;
}

/** `@name` mentions highlighted, like the rest of the report. */
function MentionText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(@[a-zA-Z0-9_.-]+)/g).map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="font-semibold text-info">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/**
 * Done tick of an additional-work row — the same round tick as the "What Did You Do Yesterday?"
 * table. Without `onClick` it is display-only.
 */
export function AdditionalWorkDoneToggle({
  completed,
  pending,
  disabled,
  title,
  onClick,
}: {
  completed: boolean;
  pending?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  const icon = pending ? (
    <Loader2 size={16} className="animate-spin text-primary" />
  ) : completed ? (
    <CheckCircle2 size={18} className="text-success" />
  ) : (
    <span className="h-4 w-4 rounded-full border-2 border-warning/60" />
  );
  if (!onClick) return <span className="flex h-6 w-6 items-center justify-center">{icon}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      title={title ?? (completed ? "Mark as not done" : "Mark as done")}
      aria-label={completed ? "Mark as not done" : "Mark as done"}
      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      {icon}
    </button>
  );
}

/**
 * Additional work (extra items recorded in the report, outside the planned tasks) as a table with
 * the same columns as the task tables. Additional work has no project / task ID / priority / due
 * date / effort, so those cells show "—". Pass `onToggle` (manager review) to make each tick a
 * check/uncheck button; it should resolve once the change is saved.
 */
export function AdditionalWorkTable({
  items,
  onToggle,
  disabled,
  disabledTitle,
}: {
  items: AdditionalWorkItem[];
  onToggle?: (item: AdditionalWorkItem) => Promise<void>;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleToggle = async (item: AdditionalWorkItem) => {
    if (!onToggle || pendingId || disabled) return;
    setPendingId(item.id);
    try {
      await onToggle(item);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className={TASK_TABLE_SCROLL}>
      <table className={cn("w-full min-w-[900px] border-collapse", STICKY_PROJECT_COL_3)}>
        <TaskTableHead withCheckbox />
        <tbody>
          {items.map((w, i) => (
            <tr key={w.id || i} className="border-b last:border-b-0 transition-colors hover:bg-muted/40">
              <td className="py-2 pr-2 align-top">
                <AdditionalWorkDoneToggle
                  completed={w.completed}
                  pending={pendingId === w.id}
                  disabled={disabled || !!pendingId}
                  title={disabled ? disabledTitle : undefined}
                  onClick={onToggle ? () => handleToggle(w) : undefined}
                />
              </td>
              <td className="py-2 pr-2 align-top text-xs font-semibold text-muted-foreground">A{i + 1}</td>
              <td className="py-2 pr-3 align-top"><AdditionalWorkDash /></td>
              <td className="py-2 pr-3 align-top"><AdditionalWorkDash /></td>
              <td className="py-2 pr-3 align-top">
                <span className={cn("block min-w-60 whitespace-normal break-words text-sm leading-snug", !w.completed && "text-muted-foreground")}>
                  <MentionText text={w.text} />
                </span>
              </td>
              <td className="w-20 py-2 pr-3 align-top"><AdditionalWorkDash /></td>
              <td className="py-2 pr-3 align-top"><AdditionalWorkDash /></td>
              <td className="py-2 pr-3 align-top"><AdditionalWorkDash /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * "Additional Work" done on the previous day — the extra items the member recorded in that day's
 * DSR outside their planned DSM tasks. Shown under "What Did You Do Yesterday?" as a table with the
 * same columns as the task tables. Renders nothing when there are none.
 *
 * Pass `onToggle` (manager review) to make each tick a check/uncheck button; it should resolve
 * once the change is saved and throw/reject if it wasn't.
 */
export function YesterdayAdditionalWork({
  items,
  onToggle,
}: {
  items: AdditionalWorkItem[];
  onToggle?: (item: AdditionalWorkItem) => Promise<void>;
}) {
  if (items.length === 0) return null;
  const doneCount = items.filter((w) => w.completed).length;

  return (
    <div className="mt-4 border-t border-border/60 pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-primary">
          <CheckCircle2 size={15} className="text-primary" />
          Additional Work
          <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {items.length} task{items.length !== 1 ? "s" : ""}
          </span>
        </h4>
        <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
          {doneCount}/{items.length} done
        </span>
      </div>
      <AdditionalWorkTable items={items} onToggle={onToggle} />
    </div>
  );
}
