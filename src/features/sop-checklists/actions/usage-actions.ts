/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { projectUserWhere } from "@/features/projects/project-user";
import { loadActingUser } from "../access";
import { checklistProgress } from "../utils";
import type { SopUsageTask } from "../types";

const d = db as any;

/**
 * The tasks this SOP is picked on — read-only. Managers see them all; anyone else only tasks they
 * own or in projects they work on, so the list doesn't reveal other projects.
 */
export async function getSopUsageAction(templateId: string): Promise<SopUsageTask[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const user = await loadActingUser(session.user.id);
  if (!user) return [];

  const rows = await d.taskChecklist.findMany({
    where: {
      templateId,
      ...(user.isManager
        ? {}
        : {
            task: {
              OR: [
                { ownerId: user.id },
                { owners: { some: { userId: user.id } } },
                { project: projectUserWhere(user.id) },
              ],
            },
          }),
    },
    select: {
      createdAt: true,
      attachedByName: true,
      items: { select: { checked: true, isRequired: true, isRemovedFromSop: true } },
      task: {
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          projectId: true,
          project: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r: any) => {
    const p = checklistProgress(r.items.filter((i: any) => !i.isRemovedFromSop));
    return {
      taskId: r.task.id,
      taskCode: r.task.code,
      taskTitle: r.task.title,
      status: r.task.status,
      projectCode: r.task.project?.code ?? r.task.projectId ?? null,
      projectName: r.task.project?.name ?? "No project",
      done: p.done,
      total: p.total,
      pickedByName: r.attachedByName,
      pickedAt: new Date(r.createdAt).toISOString(),
    };
  });
}
