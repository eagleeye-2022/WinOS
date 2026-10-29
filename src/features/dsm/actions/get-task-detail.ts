"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadActingUser } from "@/features/sop-checklists/access";
import { isTaskDone } from "@/features/projects/types";
import {
  decodeDescriptionWithTimePeriod,
  resolveLogTimePeriod,
  toISTDateString,
} from "@/features/projects/utils/time-helpers";

export type DsmTaskDetailLog = {
  id: string;
  userName: string;
  /** ISO date of the log. */
  date: string;
  /** "10:05 AM – 10:50 AM" (or the best range the log has). */
  timePeriod: string;
  minutes: number;
  billable: boolean;
  remarks: string;
};

export type DsmSubtaskRow = {
  id: string;
  code: string;
  title: string;
  status: string;
  done: boolean;
  /** 0 = direct child of the task. */
  depth: number;
  owners: string[];
  dueDate: string | null;
  priority: string | null;
  /** Everyone's time logged on the subtask itself. */
  minutes: number;
};

export type DsmTaskDetail = {
  code: string;
  title: string;
  status: string;
  dueDate: string | null;
  projectName: string | null;
  owners: string[];
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  logCount: number;
  recentLogs: DsmTaskDetailLog[];
  subtasks: { done: number; total: number };
  /** Every subtask (any depth), in tree order — parent, then its children. */
  subtaskRows: DsmSubtaskRow[];
  sop: { attached: boolean; done: number; total: number };
  /** Timers running on the task right now, by whom. */
  runningTimers: { userName: string; startedAt: string }[];
  /** Closed / done — an overdue due date only matters while this is false. */
  isDone: boolean;
  /** Everyone's time on the task, most first. */
  contributors: { name: string; minutes: number }[];
  /** Time logged on the task today (IST), everyone. */
  todayMinutes: number;
  /** Logs still waiting for approval. */
  pendingApprovals: number;
  /** ISO time of the latest change or time log on the task. */
  lastActivityAt: string | null;
  latestComment: { author: string; text: string; createdAt: string } | null;
};

const RECENT_LOGS = 5;
const COMMENT_CHARS = 200;

/** Remarks can be HTML (rich-text editor) — keep the words only. */
function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Everything about one linked task for the manager's DSM review (/dsm/member/[userId]) — the
 * row's ▸ panel: total / billable / non-billable time (everyone's), the latest time logs with who
 * logged them and their remarks, subtask and SOP progress, owners and any running timer.
 * Managers only; loaded when the panel is opened.
 */
export async function getDsmTaskDetailAction(
  taskId: string
): Promise<{ success: true; detail: DsmTaskDetail } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  const actor = await loadActingUser(session.user.id);
  if (!actor?.isManager) return { success: false, error: "Only managers can see task details here." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const task = await d.projectTask.findFirst({
    where: { OR: [{ id: taskId }, { code: taskId }] },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      completionPercentage: true,
      dueDate: true,
      owner: true,
      updatedAt: true,
      lastActivityDate: true,
      project: { select: { name: true } },
      owners: { select: { user: { select: { name: true, email: true } } } },
    },
  });
  if (!task) return { success: false, error: "Task not found." };

  // Today's logs: a ±14h window around the IST day, then exact IST-day matching below.
  const todayIst = toISTDateString(new Date());
  const todayStartUtc = new Date(`${todayIst}T00:00:00.000Z`);

  const [byBilling, recent, checklists, timers, subtaskRows, byUser, todayLogs, pendingApprovals, comment] = await Promise.all([
    d.projectTimeLog.groupBy({
      by: ["billingType"],
      where: { taskId: task.id },
      _sum: { duration: true },
      _count: { _all: true },
    }),
    d.projectTimeLog.findMany({
      where: { taskId: task.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: RECENT_LOGS,
      select: {
        id: true,
        date: true,
        createdAt: true,
        duration: true,
        billingType: true,
        description: true,
        user: { select: { name: true, email: true } },
      },
    }),
    d.taskChecklist.findMany({
      where: { taskId: task.id },
      select: { items: { select: { checked: true, isRemovedFromSop: true } } },
    }),
    d.activeTimer.findMany({
      where: { taskId: task.id },
      select: { startedAt: true, user: { select: { name: true, email: true } } },
    }),
    subtaskRowsOf(task.id, task.code),
    d.projectTimeLog.groupBy({
      by: ["userId"],
      where: { taskId: task.id },
      _sum: { duration: true },
    }),
    d.projectTimeLog.findMany({
      where: {
        taskId: task.id,
        date: {
          gte: new Date(todayStartUtc.getTime() - 14 * 3600 * 1000),
          lte: new Date(todayStartUtc.getTime() + (24 + 14) * 3600 * 1000),
        },
      },
      select: { date: true, duration: true },
    }),
    d.projectTimeLog.count({ where: { taskId: task.id, approvalStatus: "PENDING" } }),
    d.projectTaskRemark.findFirst({
      where: { taskId: task.id },
      orderBy: { createdAt: "desc" },
      select: { authorName: true, content: true, createdAt: true },
    }),
  ]);

  const userTotals = (byUser as { userId: string; _sum: { duration: number | null } }[]).filter((g) => g.userId);
  const loggers: { id: string; name: string | null; email: string }[] = userTotals.length
    ? await d.user.findMany({
        where: { id: { in: userTotals.map((g) => g.userId) } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const loggerById = new Map(loggers.map((u) => [u.id, u]));

  const todayMinutes = (todayLogs as { date: Date; duration: number }[])
    .filter((l) => toISTDateString(l.date) === todayIst)
    .reduce((s, l) => s + l.duration, 0);

  // Latest of: the task's own last change, its last activity, its newest time log.
  const activityTimes = [task.updatedAt, task.lastActivityDate, recent[0]?.createdAt]
    .filter(Boolean)
    .map((t: Date) => new Date(t).getTime());
  const lastActivityAt = activityTimes.length ? new Date(Math.max(...activityTimes)).toISOString() : null;

  const commentText = comment ? plainText(comment.content ?? "") : "";

  let billableMinutes = 0;
  let nonBillableMinutes = 0;
  let logCount = 0;
  for (const g of byBilling as { billingType: string; _sum: { duration: number | null }; _count: { _all: number } }[]) {
    const mins = g._sum.duration ?? 0;
    if (g.billingType === "BILLABLE") billableMinutes += mins;
    else nonBillableMinutes += mins;
    logCount += g._count._all;
  }

  const items = (checklists as { items: { checked: boolean; isRemovedFromSop: boolean }[] }[])
    .flatMap((c) => c.items)
    .filter((i) => !i.isRemovedFromSop);

  const nameOf = (u: { name: string | null; email: string } | null | undefined) =>
    u?.name || u?.email?.split("@")[0] || "User";

  const owners: string[] =
    task.owners.length > 0
      ? task.owners.map((o: { user: { name: string | null; email: string } }) => nameOf(o.user))
      : task.owner && task.owner !== "Unassigned"
        ? [task.owner]
        : [];

  return {
    success: true,
    detail: {
      code: task.code,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate && task.dueDate !== "--" ? task.dueDate : null,
      projectName: task.project?.name ?? null,
      owners,
      totalMinutes: billableMinutes + nonBillableMinutes,
      billableMinutes,
      nonBillableMinutes,
      logCount,
      recentLogs: recent.map(
        (l: {
          id: string;
          date: Date;
          createdAt: Date;
          duration: number;
          billingType: string;
          description: string | null;
          user: { name: string | null; email: string } | null;
        }) => {
          const decoded = decodeDescriptionWithTimePeriod(l.description);
          return {
            id: l.id,
            userName: nameOf(l.user),
            date: new Date(l.date).toISOString(),
            timePeriod: resolveLogTimePeriod(decoded.timePeriod, l.duration, l.createdAt || l.date),
            minutes: l.duration,
            billable: l.billingType === "BILLABLE",
            remarks: decoded.remarks,
          };
        }
      ),
      subtasks: { done: subtaskRows.filter((s) => s.done).length, total: subtaskRows.length },
      subtaskRows,
      isDone: isTaskDone(task.status, false, task.completionPercentage),
      contributors: userTotals
        .map((g) => ({ name: nameOf(loggerById.get(g.userId)), minutes: g._sum.duration ?? 0 }))
        .sort((a, b) => b.minutes - a.minutes),
      todayMinutes,
      pendingApprovals,
      lastActivityAt,
      latestComment:
        comment && commentText
          ? {
              author: comment.authorName,
              text: commentText.length > COMMENT_CHARS ? `${commentText.slice(0, COMMENT_CHARS).trimEnd()}…` : commentText,
              createdAt: new Date(comment.createdAt).toISOString(),
            }
          : null,
      sop: { attached: checklists.length > 0, done: items.filter((i) => i.checked).length, total: items.length },
      runningTimers: (timers as { startedAt: Date; user: { name: string | null; email: string } | null }[]).map((t) => ({
        userName: nameOf(t.user),
        startedAt: new Date(t.startedAt).toISOString(),
      })),
    },
  };
}

const MAX_SUBTASK_ROWS = 50;

/**
 * The task's subtasks at every depth, in tree order, with status / owners / due date / effort.
 * Children point at their parent's id or, on older rows, its code — same walk as subtask-gate.
 */
async function subtaskRowsOf(rootId: string, rootCode: string): Promise<DsmSubtaskRow[]> {
  type Row = {
    id: string;
    code: string;
    title: string;
    status: string;
    completionPercentage: number;
    parentTaskId: string | null;
    dueDate: string | null;
    priority: string | null;
    owner: string | null;
    owners: { user: { name: string | null; email: string } }[];
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const byParent = new Map<string, Row[]>();
  const seen = new Set<string>([rootId]);
  let frontier = [rootId, rootCode];
  while (frontier.length > 0 && seen.size <= MAX_SUBTASK_ROWS) {
    const children: Row[] = await d.projectTask.findMany({
      where: { parentTaskId: { in: frontier } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        completionPercentage: true,
        parentTaskId: true,
        dueDate: true,
        priority: true,
        owner: true,
        owners: { select: { user: { select: { name: true, email: true } } } },
      },
    });
    const fresh = children.filter((c) => !seen.has(c.id));
    for (const c of fresh) {
      seen.add(c.id);
      const list = byParent.get(c.parentTaskId!) ?? [];
      list.push(c);
      byParent.set(c.parentTaskId!, list);
    }
    frontier = fresh.flatMap((c) => [c.id, c.code]);
  }

  const ordered: { row: Row; depth: number }[] = [];
  const visit = (id: string, code: string, depth: number) => {
    const kids = [...(byParent.get(id) ?? []), ...(code !== id ? byParent.get(code) ?? [] : [])];
    for (const c of kids) {
      ordered.push({ row: c, depth });
      visit(c.id, c.code, depth + 1);
    }
  };
  visit(rootId, rootCode, 0);
  if (ordered.length === 0) return [];

  const effort: { taskId: string; _sum: { duration: number | null } }[] = await d.projectTimeLog.groupBy({
    by: ["taskId"],
    where: { taskId: { in: ordered.map((o) => o.row.id) } },
    _sum: { duration: true },
  });
  const minutesById = new Map(effort.map((e) => [e.taskId, e._sum.duration ?? 0]));

  return ordered.slice(0, MAX_SUBTASK_ROWS).map(({ row: c, depth }) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    status: c.status,
    done: isTaskDone(c.status, false, c.completionPercentage),
    depth,
    owners:
      c.owners.length > 0
        ? c.owners.map((o) => o.user.name || o.user.email.split("@")[0])
        : c.owner && c.owner !== "Unassigned"
          ? [c.owner]
          : [],
    dueDate: c.dueDate && c.dueDate !== "--" ? c.dueDate : null,
    priority: c.priority && c.priority !== "None" ? c.priority : null,
    minutes: minutesById.get(c.id) ?? 0,
  }));
}
