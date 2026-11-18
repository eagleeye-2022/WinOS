"use client";

// Subtasks nested under a task card on the boards (Projects, Project Templates, WhyFi School).
// The cyan guide line runs down past each subtask, turns into a └ corner at the LAST one, and the
// group closes with an "End of N subtasks" rule — so it's obvious where the subtasks stop and the
// next task begins, without scrolling to check.

import type { Key, ReactNode } from "react";
import { cn } from "@/lib/utils";

const LINE = "border-cyan-400/70 dark:border-cyan-500/50";

export function SubtaskTree({
  items,
  before,
  after,
  className,
  stopClicks = true,
}: {
  /** Keep clicks inside from reaching the parent card (the project boards want this). */
  stopClicks?: boolean;
  /** The subtask cards, in order. */
  items: { key: Key; content: ReactNode }[];
  /** Above the first subtask (e.g. an "add subtask" input). */
  before?: ReactNode;
  /** Below the end rule (e.g. an "add subtask" input). */
  after?: ReactNode;
  className?: string;
}) {
  const count = items.length;
  return (
    <div className={cn("ml-2.5 mt-1", className)} onClick={stopClicks ? (e) => e.stopPropagation() : undefined}>
      {before && <div className="mb-2 pl-3">{before}</div>}

      {items.map(({ key, content }, i) => {
        const last = i === count - 1;
        return (
          <div key={key} className={cn("relative pl-3", !last && "pb-2")}>
            {last ? (
              // └ — the guide line ends here.
              <span aria-hidden className={cn("absolute left-0 top-0 h-4 w-3 rounded-bl-md border-b-2 border-l-2", LINE)} />
            ) : (
              <>
                {/* │ continues down to the next subtask (through the gap) … */}
                <span aria-hidden className={cn("absolute bottom-0 left-0 top-0 border-l-2", LINE)} />
                {/* ├ … with a branch into this card. */}
                <span aria-hidden className={cn("absolute left-0 top-4 w-3 border-t-2", LINE)} />
              </>
            )}
            {content}
          </div>
        );
      })}

      {count > 0 && (
        <div className="mt-2 flex items-center gap-2 pl-3" aria-label={`End of ${count} subtask${count === 1 ? "" : "s"}`}>
          <span aria-hidden className={cn("flex-1 border-t-2 border-dashed", LINE)} />
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            End of {count} subtask{count === 1 ? "" : "s"}
          </span>
          <span aria-hidden className={cn("flex-1 border-t-2 border-dashed", LINE)} />
        </div>
      )}

      {after && <div className="mt-2 pl-3">{after}</div>}
    </div>
  );
}
