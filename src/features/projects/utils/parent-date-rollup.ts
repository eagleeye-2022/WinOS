import type { TaskItem } from "../types";
import { normalizeDueDate } from "@/features/whyfi/constants";

/**
 * Any task with subtasks (top-level or a subtask that has its own) takes its dates from them, at
 * any depth: its Start Date is the earliest start date of any subtask, its Due Date the latest due
 * date of the task itself or any subtask. A task without dated subtasks keeps its own dates.
 *
 * Each row's own stored dates are the input, so pass the rows as loaded/edited — not an already
 * rolled-up copy. Every subtask entry in a parent's `subtasks` list is given the same dates as
 * that subtask's own row, so the Subtasks table and the task cards always agree. Only the returned
 * copy changes (display) — nothing is saved. Dates are free-form strings ("YYYY-MM-DD",
 * "DD/MM/YYYY", "--"); the winning value is returned as written.
 */
export function rollUpParentDates(tasks: TaskItem[]): TaskItem[] {
  const byCode = new Map(tasks.map((t) => [t.code, t]));

  // Rolled-up dates for every row, keyed by code.
  const rolled = new Map<string, Pick<TaskItem, "startDate" | "dueDate">>();
  for (const task of tasks) {
    const own = { startDate: task.startDate, dueDate: task.dueDate };
    if (!task.subtasks?.length) {
      rolled.set(task.code, own);
      continue;
    }
    // Every subtask under it (its own row's dates when it has one), guarded against loops.
    const starts: (string | undefined)[] = [];
    const dues: (string | undefined)[] = [task.dueDate];
    const seen = new Set<string>([task.code]);
    const queue = [...task.subtasks];
    while (queue.length > 0) {
      const sub = queue.shift()!;
      if (seen.has(sub.code)) continue;
      seen.add(sub.code);
      const row = byCode.get(sub.code);
      starts.push(row ? row.startDate : sub.startDate);
      dues.push(row ? row.dueDate : sub.dueDate);
      queue.push(...(row?.subtasks ?? []));
    }
    rolled.set(task.code, {
      startDate: pickDate(starts, "min") ?? task.startDate,
      dueDate: pickDate(dues, "max") ?? task.dueDate,
    });
  }

  return tasks.map((task) => {
    const dates = rolled.get(task.code)!;
    const subtasks = task.subtasks?.map((s) => {
      const subDates = rolled.get(s.code);
      return subDates && (subDates.startDate !== s.startDate || subDates.dueDate !== s.dueDate)
        ? { ...s, ...subDates }
        : s;
    });
    const subtasksChanged = subtasks?.some((s, i) => s !== task.subtasks![i]);
    if (dates.startDate === task.startDate && dates.dueDate === task.dueDate && !subtasksChanged) return task;
    return { ...task, ...dates, ...(subtasksChanged && { subtasks }) };
  });
}

/** The earliest/latest valid date among `values` (as written), or null when none parse. */
function pickDate(values: (string | undefined)[], mode: "min" | "max"): string | null {
  let best: { raw: string; iso: string } | null = null;
  for (const raw of values) {
    const iso = normalizeDueDate(raw);
    if (!iso || !raw) continue;
    if (!best || (mode === "min" ? iso < best.iso : iso > best.iso)) best = { raw, iso };
  }
  return best?.raw ?? null;
}
