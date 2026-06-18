"use client";

import { useState } from "react";
import { Zap, ChevronDown } from "lucide-react";
import type { EntryWithDetails } from "../queries";

type TodaysFocusProps = {
  entry: EntryWithDetails | null;
};

export function TodaysFocusCard({ entry }: TodaysFocusProps) {
  const [open, setOpen] = useState(false);

  const todayTasks = entry?.tasks.filter((t) => t.kind === "TODAY") ?? [];
  const focusTask = todayTasks[0];

  return (
    <div className="rounded-xl bg-primary">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
          <Zap size={15} className="text-white" />
        </span>
        <span className="flex-1 text-left text-sm font-semibold text-white">
          Today&apos;s Focus
        </span>
        <ChevronDown
          size={16}
          className={`text-white/70 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-white/20 px-4 pb-4 pt-3">
          {focusTask ? (
            <p className="text-sm text-white/90">{focusTask.text}</p>
          ) : (
            <p className="text-sm text-white/60">
              No focus set for today. Add your first task in the form below.
            </p>
          )}
          {todayTasks.length > 1 && (
            <p className="mt-2 text-xs text-white/50">
              +{todayTasks.length - 1} more task{todayTasks.length > 2 ? "s" : ""} planned
            </p>
          )}
        </div>
      )}
    </div>
  );
}
