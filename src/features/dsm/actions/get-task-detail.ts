"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadActingUser } from "@/features/sop-checklists/access";
import { subtaskCountsOf } from "@/features/projects/subtask-gate";
import { decodeDescriptionWithTimePeriod, resolveLogTimePeriod } from "@/features/projects/utils/time-helpers";

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
  sop: { attached: boolean; done: number; total: number };
  /** Timers running on the task right now, by whom. */
  runningTimers: { userName: string; startedAt: string }[];
};

const RECENT_LOGS = 5;

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
      dueDate: true,
      owner: true,
      project: { select: { name: true } },
      owners: { select: { user: { select: { name: true, email: true } } } },
    },
  });
  if (!task) return { success: false, error: "Task not found." };

  const [byBilling, recent, checklists, timers, subtasks] = await Promise.all([
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
    subtaskCountsOf(task.id),
  ]);

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
      subtasks,
      sop: { attached: checklists.length > 0, done: items.filter((i) => i.checked).length, total: items.length },
      runningTimers: (timers as { startedAt: Date; user: { name: string | null; email: string } | null }[]).map((t) => ({
        userName: nameOf(t.user),
        startedAt: new Date(t.startedAt).toISOString(),
      })),
    },
  };
}
