// Server-side rule: a task with open subtasks can't be closed, and its timer can't be started.
// Plain module (not "use server") — called from the task status / timer write paths.
import { db } from "@/lib/db";
import { isTaskDone } from "./types";

export type OpenSubtask = { code: string; title: string };

/**
 * Subtasks of the task, at any depth, that aren't done yet. Children point at their parent's id
 * (or, on older rows, its code). Applies to Srijan tasks and WhyFi School cards alike.
 */
export async function openSubtasksOf(taskId: string): Promise<OpenSubtask[]> {
  const root = await db.projectTask.findFirst({
    where: { OR: [{ id: taskId }, { code: taskId }] },
    select: { id: true, code: true },
  });
  if (!root) return [];

  const open: OpenSubtask[] = [];
  const seen = new Set<string>([root.id]);
  let frontier = [root.id, root.code];
  while (frontier.length > 0) {
    const children = await db.projectTask.findMany({
      where: { parentTaskId: { in: frontier } },
      select: { id: true, code: true, title: true, status: true, completionPercentage: true },
      orderBy: { createdAt: "asc" },
    });
    const fresh = children.filter((c) => !seen.has(c.id));
    for (const c of fresh) {
      seen.add(c.id);
      if (!isTaskDone(c.status, false, c.completionPercentage)) open.push({ code: c.code, title: c.title });
    }
    frontier = fresh.flatMap((c) => [c.id, c.code]);
  }
  return open;
}

/** How many subtasks (any depth) the task has, and how many of them are done. */
export async function subtaskCountsOf(taskId: string): Promise<{ done: number; total: number }> {
  const root = await db.projectTask.findFirst({
    where: { OR: [{ id: taskId }, { code: taskId }] },
    select: { id: true, code: true },
  });
  if (!root) return { done: 0, total: 0 };
  let done = 0;
  let total = 0;
  const seen = new Set<string>([root.id]);
  let frontier = [root.id, root.code];
  while (frontier.length > 0) {
    const children = await db.projectTask.findMany({
      where: { parentTaskId: { in: frontier } },
      select: { id: true, code: true, status: true, completionPercentage: true },
    });
    const fresh = children.filter((c) => !seen.has(c.id));
    for (const c of fresh) {
      seen.add(c.id);
      total++;
      if (isTaskDone(c.status, false, c.completionPercentage)) done++;
    }
    frontier = fresh.flatMap((c) => [c.id, c.code]);
  }
  return { done, total };
}

/** "Subtasks not done:EEDP-T02.1 Design, EEDP-T02.2 Review…" — for the refusal popup / toast. */
export function openSubtasksMessage(open: OpenSubtask[], action: "close" | "timer"): string {
  const list = open
    .slice(0, 5)
    .map((s) => `${s.code} ${s.title}`)
    .join(", ");
  const more = open.length > 5 ? ` and ${open.length - 5} more` : "";
  const what =
    action === "close" ? "This task can't be marked done" : "The timer can't run on this task";
  return `${what} until its subtasks are done. Not done yet: ${list}${more}.`;
}
