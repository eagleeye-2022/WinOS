/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getTaskAccess, loadActingUser } from "../access";
import type { SopEventView } from "../event-types";

const d = db as any;
const PAGE_SIZE = 100;

export interface SopTimelineQuery {
  /** One SOP's whole history (managers). */
  templateId?: string;
  /** Everything on one task (anyone who can work on it); narrowed by templateId / checklistId. */
  taskId?: string;
  checklistId?: string;
  /** ISO time of the last event already shown — loads the page before it. */
  before?: string;
}

/** Reads the SOP checklist timeline (SopChecklistEvent) — read-only. Newest first, 100 at a time. */
export async function getSopTimelineAction(
  query: SopTimelineQuery
): Promise<{ events: SopEventView[]; hasMore: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { events: [], hasMore: false, error: "Unauthorized" };
  const user = await loadActingUser(session.user.id);
  if (!user) return { events: [], hasMore: false, error: "Unauthorized" };

  const where: any = {};
  if (query.taskId) {
    const access = await getTaskAccess(query.taskId, user);
    if (!access || !access.canCheck) return { events: [], hasMore: false, error: "You can't view this task" };
    where.taskId = access.task.id;
    if (query.checklistId) where.checklistId = query.checklistId;
    if (query.templateId) where.templateId = query.templateId;
  } else if (query.templateId) {
    if (!user.isManager) return { events: [], hasMore: false, error: "Only managers can view an SOP's timeline" };
    where.templateId = query.templateId;
  } else {
    return { events: [], hasMore: false, error: "Nothing to show" };
  }
  if (query.before) where.createdAt = { lt: new Date(query.before) };

  const rows = await d.sopChecklistEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
  });

  return {
    hasMore: rows.length > PAGE_SIZE,
    events: rows.slice(0, PAGE_SIZE).map((r: any) => ({
      id: r.id,
      type: r.type,
      templateId: r.templateId,
      templateName: r.templateName,
      checklistId: r.checklistId,
      taskId: r.taskId,
      taskCode: r.taskCode,
      taskTitle: r.taskTitle,
      projectCode: r.projectCode,
      itemText: r.itemText,
      details: r.details && typeof r.details === "object" ? r.details : null,
      actorId: r.actorId,
      actorName: r.actorName,
      createdAt: new Date(r.createdAt).toISOString(),
    })),
  };
}
