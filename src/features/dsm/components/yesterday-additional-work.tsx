"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdditionalWorkItem = { id: string; text: string; completed: boolean };

/**
 * "Additional Work" done on the previous day — the extra items the member recorded in that day's
 * DSR outside their planned DSM tasks. Shown under "What Did You Do Yesterday?" and styled like
 * that section (same heading, count chip and tick icons). Renders nothing when there are none.
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
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (items.length === 0) return null;

  const handleToggle = async (item: AdditionalWorkItem) => {
    if (!onToggle || pendingId) return;
    setPendingId(item.id);
    try {
      await onToggle(item);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="mt-4 border-t border-border/60 pt-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
        <CheckCircle2 size={15} className="text-primary dark:text-[#3B82F6]" />
        Additional Work
        <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          {items.length} task{items.length !== 1 ? "s" : ""}
        </span>
      </h4>
      <div className="flex flex-col gap-2">
        {items.map((w) => {
          const icon =
            pendingId === w.id ? (
              <Loader2 size={18} className="shrink-0 animate-spin text-success" />
            ) : w.completed ? (
              <CheckCircle2 size={18} className="shrink-0 text-success" />
            ) : (
              <Circle size={18} className="shrink-0 text-muted-foreground/50" />
            );
          return (
            <div key={w.id} className="flex items-center gap-2.5 text-sm">
              {onToggle ? (
                <button
                  type="button"
                  onClick={() => handleToggle(w)}
                  disabled={!!pendingId}
                  title={w.completed ? "Mark as not done" : "Mark as done"}
                  aria-label={w.completed ? `Mark "${w.text}" as not done` : `Mark "${w.text}" as done`}
                  className="shrink-0 cursor-pointer rounded-full transition-transform hover:scale-110 disabled:cursor-wait"
                >
                  {icon}
                </button>
              ) : (
                icon
              )}
              <span className={cn(!w.completed && "text-muted-foreground")}>{w.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
