"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/toast";
import { updateTaskAction } from "@/features/projects/actions/project-actions";
import { PROJECT_TASK_STATUSES, getTaskStatusBadgeClasses, type TaskStatus } from "@/features/projects/types";

/**
 * Status dropdown for a linked project task (Srijan). Saves straight to the ProjectTask via the
 * Projects module's `updateTaskAction` — same permission check and activity log as changing it
 * in Srijan. Optimistic: shows the new status immediately and rolls back if the save fails.
 */
export function ProjectTaskStatusPill({
  taskId,
  status,
  label,
  onStatusChange,
  className,
}: {
  /** ProjectTask id (task or subtask). */
  taskId: string;
  status: string;
  /** Task code/title, used in the tooltip. */
  label?: string | null;
  /** Called with the new status on change, and with the old one again if the save fails. */
  onStatusChange?: (status: string) => void;
  className?: string;
}) {
  const [current, setCurrent] = useState(status);
  const [prevProp, setPrevProp] = useState(status);
  const [saving, startSave] = useTransition();

  // Follow the prop when the parent's data changes (e.g. a different task is linked).
  if (prevProp !== status) {
    setPrevProp(status);
    setCurrent(status);
  }

  const change = (next: string) => {
    if (next === current) return;
    const previous = current;
    setCurrent(next);
    onStatusChange?.(next);
    startSave(async () => {
      const res = await updateTaskAction(taskId, { status: next as TaskStatus });
      if (!res.success) {
        setCurrent(previous);
        onStatusChange?.(previous);
        toast.error(res.error || "Could not update the status.");
        return;
      }
      toast.success(`Status set to ${next}`);
    });
  };

  return (
    <select
      value={current}
      onChange={(e) => change(e.target.value)}
      disabled={saving}
      title={`Status of ${label || "this task"} in Srijan`}
      aria-label="Project task status"
      className={cn(
        "cursor-pointer appearance-none rounded-full px-2.5 py-0.5 text-[11px] font-semibold outline-none disabled:opacity-60",
        getTaskStatusBadgeClasses(current),
        className
      )}
    >
      {[...new Set([current, ...PROJECT_TASK_STATUSES])].map((s) => (
        <option key={s} value={s} className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">
          {s}
        </option>
      ))}
    </select>
  );
}
