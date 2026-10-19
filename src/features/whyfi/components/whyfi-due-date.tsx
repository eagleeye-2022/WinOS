"use client";

import { useEffect, useState, useTransition } from "react";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/toast";
import { DueDateInput } from "@/components/shared/task-table-parts";
import { toIsoDateStr, toUtcDate } from "@/features/dsm/utils";
import { getMyWhyfiTasksAction, updateWhyfiTaskAction, type WhyfiPickerTask } from "../actions";

/**
 * Open Whyfi School cards, fetched once per mount: the viewer's own (managers: every list), or —
 * with `forUserId`, on a manager's review of a member's DSM — only that member's lists.
 */
export function useWhyfiTasks(forUserId?: string) {
  const [tasks, setTasks] = useState<WhyfiPickerTask[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    getMyWhyfiTasksAction(forUserId)
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [forUserId]);
  /** Keeps a card's due date in the local list in step after it's saved. */
  const setDueDate = (taskId: string, dueDate: string) =>
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, dueDate } : t)));
  return { tasks, setTasks, loading, setDueDate };
}

/**
 * "DUE: <date> [Today]" for a DSM learning row linked to a Whyfi School card — same look as the
 * DSM task rows. The date is saved straight onto the card (learning rows themselves are plain
 * text), so it also shows on the card in Whyfi School.
 */
export function WhyfiDueDate({
  task,
  onSaved,
}: {
  task: WhyfiPickerTask;
  onSaved: (taskId: string, dueDate: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const todayIso = toIsoDateStr(toUtcDate());
  const isToday = task.dueDate === todayIso;

  const save = (dueDate: string) => {
    if (dueDate === task.dueDate) return;
    const previous = task.dueDate;
    onSaved(task.id, dueDate); // optimistic
    startTransition(async () => {
      const res = await updateWhyfiTaskAction(task.id, { dueDate });
      if (!res.success) {
        onSaved(task.id, previous);
        toast.error(res.error || "Couldn't save the due date");
      }
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
        <CalendarIcon size={12} className="text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider">Due:</span>
        <DueDateInput value={task.dueDate} onChange={save} disabled={pending} />
        {pending && <Loader2 size={11} className="animate-spin" />}
      </div>
      <button
        type="button"
        onClick={() => save(todayIso)}
        disabled={isToday || pending}
        title="Set the due date to today"
        className={cn(
          "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
          isToday
            ? "cursor-default border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
        )}
      >
        Today
      </button>
    </div>
  );
}
