import { db } from "@/lib/db";
import { parseRule, serializeRule } from "./recurring-utils";
import { toUtcDate } from "./utils";

/**
 * Keeps a Srijan task's recurrence and its DSM recurring templates (`RecurringStandupTask` rows
 * with that `projectTaskId`) the same, in both directions — the recurrence twin of due-date-sync.
 * The Srijan side lives in `ProjectTask.recurrence` (a serialized RecurrenceRule, or "None") plus
 * `hasRecurrence`.
 *  - DSM → Srijan: `syncRecurrenceFromDsm` after a linked template is created, edited, paused,
 *    resumed or deleted. Turning it off anywhere turns it off everywhere (templates are paused,
 *    never deleted).
 *  - Srijan → DSM: `syncRecurrenceFromProjectTask` after the Srijan task's recurrence changes.
 *    Existing templates take the new rule; people who recently had the task in their DSM but no
 *    template yet get one. Nobody else's DSM gains a row.
 *  - New DSM rows: `adoptProjectRecurrence` links a saved row to (or creates) the user's template
 *    when its Srijan task already repeats.
 * All of these are best effort: the save that triggered them has already succeeded.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const d = db as any;

/** A DSM row this recent (in days) makes its owner count as "using" a Srijan task. */
export const RECURRENCE_ADOPT_WINDOW_DAYS = 7;

/** Serialized rule, or null for "does not repeat" ("None", empty, legacy/unparseable values). */
export function normalizeRecurrence(value: string | null | undefined): string | null {
  const rule = parseRule(value);
  return rule ? serializeRule(rule) : null;
}

/** DSM → Srijan (and every other DSM template linked to the same task). `rule` null = off. */
export async function syncRecurrenceFromDsm(projectTaskId: string | null | undefined, rule: string | null) {
  if (!projectTaskId) return;
  const next = normalizeRecurrence(rule);
  try {
    const task = await d.projectTask.findUnique({
      where: { id: projectTaskId },
      select: { recurrence: true, hasRecurrence: true },
    });
    if (!task) return;
    const unchanged = normalizeRecurrence(task.recurrence) === next && task.hasRecurrence === Boolean(next);
    await Promise.all([
      unchanged
        ? null
        : d.projectTask.update({
            where: { id: projectTaskId },
            data: { recurrence: next ?? "None", hasRecurrence: Boolean(next), lastActivityDate: new Date() },
          }),
      d.recurringStandupTask.updateMany({
        where: { projectTaskId },
        data: next ? { recurrenceRule: next, isActive: true } : { isActive: false },
      }),
    ]);
  } catch (err) {
    console.error("[recurrence-sync] DSM → Srijan failed:", err);
  }
}

/** Srijan → DSM. `rule` null = off (pauses every linked template). */
export async function syncRecurrenceFromProjectTask(projectTaskId: string, rule: string | null, actorId: string) {
  const next = normalizeRecurrence(rule);
  try {
    if (!next) {
      await d.recurringStandupTask.updateMany({ where: { projectTaskId, isActive: true }, data: { isActive: false } });
      return;
    }
    await d.recurringStandupTask.updateMany({
      where: { projectTaskId },
      data: { recurrenceRule: next, isActive: true },
    });

    // People who had this task in their DSM recently: give each a template (if they have none)
    // and link their recent rows to it, so the DSM form doesn't show the task twice.
    const today = toUtcDate();
    const since = new Date(today.getTime() - RECURRENCE_ADOPT_WINDOW_DAYS * 86_400_000);
    const [rows, templates, task] = await Promise.all([
      d.standupTask.findMany({
        where: { projectTaskId, entry: { date: { gte: since } } },
        orderBy: { entry: { date: "desc" } },
        select: { id: true, text: true, priority: true, recurringTaskId: true, entry: { select: { userId: true } } },
      }),
      d.recurringStandupTask.findMany({ where: { projectTaskId }, select: { id: true, userId: true } }),
      d.projectTask.findUnique({ where: { id: projectTaskId }, select: { projectId: true } }),
    ]);
    if (!task) return;

    const templateByUser = new Map<string, string>(
      (templates as { id: string; userId: string }[]).map((t) => [t.userId, t.id])
    );
    type Row = { id: string; text: string; priority: string | null; recurringTaskId: string | null; entry: { userId: string } };
    const rowsByUser = new Map<string, Row[]>();
    for (const r of rows as Row[]) {
      const list = rowsByUser.get(r.entry.userId) ?? [];
      list.push(r);
      rowsByUser.set(r.entry.userId, list);
    }

    for (const [userId, userRows] of rowsByUser) {
      let templateId = templateByUser.get(userId);
      if (!templateId) {
        const latest = userRows[0]; // newest entry first — its wording is what the user sees in DSM
        const count = await d.recurringStandupTask.count({ where: { userId } });
        const created = await d.recurringStandupTask.create({
          data: {
            userId,
            createdById: actorId,
            text: latest.text,
            priority: latest.priority || null,
            projectId: task.projectId || null,
            projectTaskId,
            recurrenceRule: next,
            startDate: today,
            isActive: true,
            order: count,
          },
          select: { id: true },
        });
        templateId = created.id as string;
      }
      const unlinked = userRows.filter((r) => !r.recurringTaskId).map((r) => r.id);
      if (unlinked.length > 0) {
        await d.standupTask.updateMany({ where: { id: { in: unlinked } }, data: { recurringTaskId: templateId } });
      }
    }
  } catch (err) {
    console.error("[recurrence-sync] Srijan → DSM failed:", err);
  }
}

type AdoptableRow = {
  text: string;
  priority: string | null;
  projectId: string | null;
  projectTaskId: string | null;
  recurringTaskId: string | null;
};

/**
 * New DSM rows: a row linked to a repeating Srijan task, but to no template, gets the user's
 * template for that task (created if missing). Mutates `rows[i].recurringTaskId` — call before the
 * rows are written.
 */
export async function adoptProjectRecurrence(userId: string, rows: AdoptableRow[], startDate: Date) {
  const candidates = rows.filter((r) => r.projectTaskId && !r.recurringTaskId);
  if (candidates.length === 0) return;
  try {
    const ids = [...new Set(candidates.map((r) => r.projectTaskId as string))];
    const tasks: { id: string; recurrence: string | null }[] = await d.projectTask.findMany({
      where: { id: { in: ids } },
      select: { id: true, recurrence: true },
    });
    const ruleByTask = new Map<string, string>();
    for (const t of tasks) {
      const rule = normalizeRecurrence(t.recurrence);
      if (rule) ruleByTask.set(t.id, rule);
    }
    if (ruleByTask.size === 0) return;

    const existing: { id: string; projectTaskId: string; isActive: boolean }[] = await d.recurringStandupTask.findMany({
      where: { userId, projectTaskId: { in: [...ruleByTask.keys()] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, projectTaskId: true, isActive: true },
    });
    const templateByTask = new Map<string, { id: string; isActive: boolean }>();
    for (const e of existing) {
      // Prefer an active template when a user somehow has more than one for the same task.
      if (!templateByTask.has(e.projectTaskId) || e.isActive) templateByTask.set(e.projectTaskId, e);
    }

    let order: number | undefined;
    for (const row of candidates) {
      const taskId = row.projectTaskId as string;
      const rule = ruleByTask.get(taskId);
      if (!rule) continue;
      let template = templateByTask.get(taskId);
      if (!template) {
        if (order === undefined) order = (await d.recurringStandupTask.count({ where: { userId } })) as number;
        const created = await d.recurringStandupTask.create({
          data: {
            userId,
            createdById: userId,
            text: row.text,
            priority: row.priority || null,
            projectId: row.projectId || null,
            projectTaskId: taskId,
            recurrenceRule: rule,
            startDate,
            isActive: true,
            order: order++,
          },
          select: { id: true },
        });
        template = { id: created.id, isActive: true };
        templateByTask.set(taskId, template);
      } else if (!template.isActive) {
        await d.recurringStandupTask.update({
          where: { id: template.id },
          data: { recurrenceRule: rule, isActive: true },
        });
        template.isActive = true;
      }
      row.recurringTaskId = template.id;
    }
  } catch (err) {
    console.error("[recurrence-sync] adopt Srijan recurrence failed:", err);
  }
}
