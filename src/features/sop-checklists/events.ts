/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/db";
import type { SopEventType } from "./event-types";

/**
 * Writes the SOP checklist timeline (SopChecklistEvent). INSERT-only — it reads other tables just
 * to copy in names (task code/title, SOP name) and never changes them. Best effort: a failed write
 * is logged and never fails the action that triggered it. Plain server module.
 */

const d = db as any;

export interface SopEventActor {
  id: string;
  name: string;
}

export interface SopEventInput {
  type: SopEventType;
  templateId?: string | null;
  templateName?: string | null;
  checklistId?: string | null;
  taskId?: string | null;
  itemText?: string | null;
  details?: Record<string, unknown> | null;
}

async function taskInfo(taskId: string) {
  const t = await d.projectTask.findUnique({
    where: { id: taskId },
    select: { code: true, title: true, projectId: true, project: { select: { code: true } } },
  });
  return t ? { taskCode: t.code, taskTitle: t.title, projectCode: t.project?.code ?? t.projectId ?? null } : null;
}

/** Records events by one person. Task code/title/project are looked up once per task. */
export async function recordSopEvents(actor: SopEventActor | null, events: SopEventInput[]): Promise<void> {
  if (events.length === 0) return;
  try {
    const cache = new Map<string, Awaited<ReturnType<typeof taskInfo>>>();
    const rows = [];
    for (const e of events) {
      let info = null;
      if (e.taskId) {
        if (!cache.has(e.taskId)) cache.set(e.taskId, await taskInfo(e.taskId));
        info = cache.get(e.taskId) ?? null;
      }
      rows.push({
        type: e.type,
        templateId: e.templateId ?? null,
        templateName: e.templateName ?? null,
        checklistId: e.checklistId ?? null,
        taskId: e.taskId ?? null,
        taskCode: info?.taskCode ?? null,
        taskTitle: info?.taskTitle ?? null,
        projectCode: info?.projectCode ?? null,
        itemText: e.itemText ? String(e.itemText).slice(0, 500) : null,
        details: e.details ?? undefined,
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? null,
      });
    }
    await d.sopChecklistEvent.createMany({ data: rows });
  } catch (err) {
    console.error("[sop-timeline] Failed to record events:", err);
  }
}

export function recordSopEvent(actor: SopEventActor | null, event: SopEventInput): Promise<void> {
  return recordSopEvents(actor, [event]);
}

/**
 * A task was closed: one TASK_CLOSED (or TASK_FORCE_CLOSED) event per checklist on it, so it shows
 * in each SOP's timeline. A force-close of a task with no checklist is still recorded (task only).
 */
export async function recordTaskClosed(
  actor: SopEventActor,
  taskId: string,
  forced: { reason: "NO_CHECKLIST" | "INCOMPLETE"; done: number; total: number } | null
): Promise<void> {
  try {
    const checklists = await d.taskChecklist.findMany({
      where: { taskId },
      select: {
        id: true,
        name: true,
        templateId: true,
        items: { select: { checked: true, isRemovedFromSop: true } },
      },
    });
    if (checklists.length === 0) {
      if (forced) await recordSopEvent(actor, { type: "TASK_FORCE_CLOSED", taskId, details: forced });
      return;
    }
    await recordSopEvents(
      actor,
      checklists.map((c: any) => {
        const items = c.items.filter((i: any) => !i.isRemovedFromSop);
        const done = items.filter((i: any) => i.checked).length;
        return {
          type: forced ? "TASK_FORCE_CLOSED" : "TASK_CLOSED",
          templateId: c.templateId,
          templateName: c.name,
          checklistId: c.id,
          taskId,
          details: forced ? { ...forced } : { done, total: items.length },
        } as SopEventInput;
      })
    );
  } catch (err) {
    console.error("[sop-timeline] Failed to record task close:", err);
  }
}
