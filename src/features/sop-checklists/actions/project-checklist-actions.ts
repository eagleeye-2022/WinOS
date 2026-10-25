/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { isTaskDone } from "@/features/projects/types";
import { isProjectUser } from "@/features/projects/project-user";
import { loadActingUser, logTaskActivity } from "../access";
import { sopCopyCreateData } from "../sync";
import { recordSopEvent } from "../events";
import { checklistProgress } from "../utils";
import { ChecklistSummary, ProjectChecklistOverview } from "../types";

const d = db as any;

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

/** Session user + the project (by id or code) + whether they may view / manage its checklists. */
async function projectAccess(projectIdOrCode: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await loadActingUser(session.user.id);
  if (!user) return null;
  const project = await d.project.findFirst({
    where: { OR: [{ id: projectIdOrCode }, { code: projectIdOrCode }] },
    select: { id: true, code: true },
  });
  if (!project) return null;
  const canView = user.isManager || (await isProjectUser(user.id, project.id));
  return { user, project, canView, canManage: user.isManager };
}

function summarize(c: any): ChecklistSummary {
  const p = checklistProgress((c.items || []).filter((i: any) => !i.isRemovedFromSop));
  return {
    id: c.id,
    name: c.name,
    templateId: c.templateId,
    isBehind: !!c.template && c.templateVersion < c.template.version,
    done: p.done,
    total: p.total,
    requiredOpen: p.requiredOpen,
  };
}

const CHECKLIST_SUMMARY_SELECT = {
  id: true,
  name: true,
  templateId: true,
  templateVersion: true,
  template: { select: { version: true } },
  items: { select: { checked: true, isRequired: true, isRemovedFromSop: true } },
} as const;

/** Every task of the project with a summary of its checklists — the project's Checklist tab. */
export async function getProjectChecklistOverviewAction(projectIdOrCode: string): Promise<ProjectChecklistOverview> {
  const empty: ProjectChecklistOverview = { projectCode: null, canManage: false, tasks: [] };
  const access = await projectAccess(projectIdOrCode);
  if (!access || !access.canView) return empty;

  const tasks = await d.projectTask.findMany({
    where: { projectId: access.project.id },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      completionPercentage: true,
      parentTaskId: true,
      phaseName: true,
      checklists: { select: CHECKLIST_SUMMARY_SELECT, orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return {
    projectCode: access.project.code || access.project.id,
    canManage: access.canManage,
    tasks: tasks.map((t: any) => ({
      id: t.id,
      code: t.code,
      title: t.title,
      status: t.status,
      phaseName: t.phaseName,
      isSubtask: !!t.parentTaskId,
      isDone: isTaskDone(t.status, false, t.completionPercentage),
      checklists: t.checklists.map(summarize),
    })),
  };
}

/** Checklist progress per task id, for the progress chips on the task board. */
export async function getTaskChecklistSummariesAction(
  projectIdOrCode: string
): Promise<Record<string, { done: number; total: number; requiredOpen: number }>> {
  const access = await projectAccess(projectIdOrCode);
  if (!access || !access.canView) return {};

  const rows = await d.taskChecklist.findMany({
    where: { task: { projectId: access.project.id } },
    select: { taskId: true, items: { select: { checked: true, isRequired: true, isRemovedFromSop: true } } },
  });

  const out: Record<string, { done: number; total: number; requiredOpen: number }> = {};
  for (const r of rows) {
    const p = checklistProgress(r.items.filter((i: any) => !i.isRemovedFromSop));
    const acc = (out[r.taskId] ||= { done: 0, total: 0, requiredOpen: 0 });
    acc.done += p.done;
    acc.total += p.total;
    acc.requiredOpen += p.requiredOpen;
  }
  return out;
}

/** Attaches one SOP to many tasks of a project at once. Tasks that already have it are skipped. */
export async function bulkAttachSopChecklistAction(
  projectIdOrCode: string,
  templateId: string,
  taskIds: string[]
): Promise<Result<{ attached: number; skipped: number }>> {
  const access = await projectAccess(projectIdOrCode);
  if (!access) return { success: false, error: "Project not found" };
  if (!access.canManage) return { success: false, error: "Only managers can attach SOP checklists" };
  if (taskIds.length === 0) return { success: false, error: "Select at least one task" };
  if (taskIds.length > 500) return { success: false, error: "Select at most 500 tasks at a time" };

  const template = await d.sopChecklistTemplate.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!template || template.isArchived) return { success: false, error: "This SOP isn't available any more" };

  // Only tasks of this project; and not the ones that already carry this SOP.
  const tasks = await d.projectTask.findMany({
    where: { id: { in: taskIds }, projectId: access.project.id },
    select: { id: true, checklists: { select: { templateId: true } } },
  });
  const targets = tasks.filter((t: any) => !t.checklists.some((c: any) => c.templateId === templateId));

  let attached = 0;
  for (const t of targets) {
    try {
      const row = await d.taskChecklist.create({ data: sopCopyCreateData(template, t.id, t.checklists.length, access.user) });
      attached++;
      await logTaskActivity(t.id, access.user, `attached the SOP checklist "${template.name}"`);
      await recordSopEvent(access.user, {
        type: "CHECKLIST_ATTACHED",
        templateId,
        templateName: template.name,
        checklistId: row.id,
        taskId: t.id,
        details: { version: template.version, steps: template.items.length, via: "bulk" },
      });
    } catch (err: any) {
      if (err?.code !== "P2002") throw err; // attached meanwhile by someone else — skip
    }
  }

  revalidatePath("/projects/sop-checklists");
  return { success: true, attached, skipped: taskIds.length - attached };
}
