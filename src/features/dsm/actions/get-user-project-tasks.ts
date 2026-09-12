"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getUserOpenProjectTasks,
  getLinkedTimeLogsYesterday,
  getProjectStandupRollup,
  getUserProjectsWithTasksAndSubtasks,
  getDailyTimeSummaryForTasks,
  type OpenProjectTaskOption,
  type ProjectStandupRollupItem,
  type CascadingProjectOption,
  type DailyTimeSummary,
} from "../queries";

export async function fetchUserOpenProjectTasksAction(): Promise<OpenProjectTaskOption[]> {
  return await getUserOpenProjectTasks();
}

export async function fetchUserProjectsWithTasksAction(): Promise<CascadingProjectOption[]> {
  return await getUserProjectsWithTasksAndSubtasks();
}

export async function fetchLinkedTimeLogsAction(projectTaskIds: string[]): Promise<Record<string, number>> {
  return await getLinkedTimeLogsYesterday(undefined, projectTaskIds);
}

export async function fetchProjectStandupRollupAction(projectId: string): Promise<ProjectStandupRollupItem[]> {
  return await getProjectStandupRollup(projectId);
}

export async function fetchDailyTimeSummaryAction(
  taskIds: string[],
  date: string, // "YYYY-MM-DD"
  userId?: string
): Promise<Record<string, DailyTimeSummary>> {
  const session = await auth();
  if (!session?.user?.id) return {};

  let targetUserId = session.user.id;
  if (userId && userId !== session.user.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viewer = await (db as any).user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (viewer?.role !== "MANAGER") return {};
    targetUserId = userId;
  }

  if (taskIds.length === 0) return {};
  return await getDailyTimeSummaryForTasks(targetUserId, taskIds, new Date(date));
}
