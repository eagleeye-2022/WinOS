/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ActingUser, getTaskAccess, loadActingUser, logTaskActivity, TaskAccess } from "../access";
import { applyChecklistSync } from "../sync";
import { normalizeEvidenceUrl } from "../utils";
import { docFromItems, isDocNode } from "../doc";
import { TaskChecklistsPayload, TaskChecklistView } from "../types";

const d = db as any;

const SOP_PATH = "/projects/sop-checklists";

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

async function currentUser(): Promise<ActingUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return loadActingUser(session.user.id);
}

/** Session user + their rights on the task that owns `checklistId`. */
async function accessForChecklist(
  checklistId: string
): Promise<{ user: ActingUser; access: TaskAccess; checklist: any } | { error: string }> {
  const user = await currentUser();
  if (!user) return { error: "Unauthorized" };
  const checklist = await d.taskChecklist.findUnique({
    where: { id: checklistId },
    select: { id: true, name: true, taskId: true, templateId: true },
  });
  if (!checklist) return { error: "This checklist no longer exists — reload the page." };
  const access = await getTaskAccess(checklist.taskId, user);
  if (!access) return { error: "Task not found" };
  return { user, access, checklist };
}

async function accessForItem(itemId: string) {
  const item = await d.taskChecklistItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "This checklist item no longer exists — reload the page." } as const;
  const res = await accessForChecklist(item.checklistId);
  if ("error" in res) return res;
  return { ...res, item };
}

function toView(row: any): TaskChecklistView {
  return {
    id: row.id,
    name: row.name,
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    latestTemplateVersion: row.template ? row.template.version : null,
    content: isDocNode(row.content) ? row.content : null,
    attachedByName: row.attachedByName,
    items: (row.items || []).map((i: any) => ({
      id: i.id,
      sourceItemId: i.sourceItemId,
      text: i.text,
      position: i.position,
      isRequired: i.isRequired,
      requiresEvidence: i.requiresEvidence,
      isRemovedFromSop: i.isRemovedFromSop,
      checked: i.checked,
      checkedByName: i.checkedByName,
      checkedAt: i.checkedAt ? new Date(i.checkedAt).toISOString() : null,
      note: i.note,
      evidenceUrl: i.evidenceUrl,
    })),
  };
}

const CHECKLIST_INCLUDE = {
  items: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
  template: { select: { version: true } },
} as const;

export async function getTaskChecklistsAction(taskId: string): Promise<TaskChecklistsPayload> {
  const empty: TaskChecklistsPayload = { checklists: [], canManage: false, canCheck: false };
  const user = await currentUser();
  if (!user) return empty;
  const access = await getTaskAccess(taskId, user);
  if (!access) return empty;

  const rows = await d.taskChecklist.findMany({
    where: { taskId: access.task.id },
    include: CHECKLIST_INCLUDE,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  return { checklists: rows.map(toView), canManage: access.canManage, canCheck: access.canCheck };
}

export async function attachSopChecklistAction(
  taskId: string,
  templateId: string
): Promise<Result<{ checklist: TaskChecklistView }>> {
  const user = await currentUser();
  if (!user) return { success: false, error: "Unauthorized" };
  const access = await getTaskAccess(taskId, user);
  if (!access) return { success: false, error: "Task not found" };
  if (!access.canManage) return { success: false, error: "Only managers can attach SOP checklists" };

  const template = await d.sopChecklistTemplate.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!template || template.isArchived) return { success: false, error: "This SOP isn't available any more" };

  const already = await d.taskChecklist.findFirst({ where: { taskId: access.task.id, templateId } });
  if (already) return { success: false, error: `"${template.name}" is already attached to this task` };

  const count = await d.taskChecklist.count({ where: { taskId: access.task.id } });
  const row = await d.taskChecklist.create({
    data: {
      taskId: access.task.id,
      templateId,
      templateVersion: template.version,
      // Older list-only SOPs get a checkbox-list document, so every attached copy renders the same way.
      content: (isDocNode(template.content) ? template.content : docFromItems(template.items)) as any,
      name: template.name,
      position: count,
      attachedById: user.id,
      attachedByName: user.name,
      items: {
        create: template.items.map((i: any) => ({
          sourceItemId: i.id,
          text: i.text,
          position: i.position,
          isRequired: i.isRequired,
          requiresEvidence: i.requiresEvidence,
        })),
      },
    },
    include: CHECKLIST_INCLUDE,
  });

  await logTaskActivity(access.task.id, user, `attached the SOP checklist "${template.name}"`);
  revalidatePath(SOP_PATH);
  return { success: true, checklist: toView(row) };
}

export async function createCustomChecklistAction(
  taskId: string,
  name: string
): Promise<Result<{ checklist: TaskChecklistView }>> {
  const user = await currentUser();
  if (!user) return { success: false, error: "Unauthorized" };
  const access = await getTaskAccess(taskId, user);
  if (!access) return { success: false, error: "Task not found" };
  if (!access.canManage) return { success: false, error: "Only managers can add checklists" };

  const trimmed = (name || "").trim().slice(0, 120);
  if (!trimmed) return { success: false, error: "Give the checklist a name" };

  const count = await d.taskChecklist.count({ where: { taskId: access.task.id } });
  const row = await d.taskChecklist.create({
    data: {
      taskId: access.task.id,
      name: trimmed,
      position: count,
      attachedById: user.id,
      attachedByName: user.name,
    },
    include: CHECKLIST_INCLUDE,
  });

  await logTaskActivity(access.task.id, user, `added the checklist "${trimmed}"`);
  return { success: true, checklist: toView(row) };
}

export async function detachChecklistAction(checklistId: string): Promise<Result> {
  const res = await accessForChecklist(checklistId);
  if ("error" in res) return { success: false, error: res.error };
  if (!res.access.canManage) return { success: false, error: "Only managers can remove checklists" };

  await d.taskChecklist.delete({ where: { id: checklistId } });
  await logTaskActivity(res.access.task.id, res.user, `removed the checklist "${res.checklist.name}"`);
  revalidatePath(SOP_PATH);
  return { success: true };
}

/** Pulls the latest SOP version into this one task's copy (same rules as "push update"). */
export async function syncTaskChecklistAction(checklistId: string): Promise<Result<{ checklist: TaskChecklistView }>> {
  const res = await accessForChecklist(checklistId);
  if ("error" in res) return { success: false, error: res.error };
  if (!res.access.canManage) return { success: false, error: "Only managers can update checklists" };
  if (!res.checklist.templateId) return { success: false, error: "This checklist isn't linked to an SOP" };

  const template = await d.sopChecklistTemplate.findUnique({
    where: { id: res.checklist.templateId },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!template) return { success: false, error: "The SOP for this checklist no longer exists" };

  const content = isDocNode(template.content) ? template.content : docFromItems(template.items);
  await d.$transaction((tx: any) => applyChecklistSync(tx, checklistId, template.items, template.version, content));
  const row = await d.taskChecklist.findUnique({ where: { id: checklistId }, include: CHECKLIST_INCLUDE });

  await logTaskActivity(res.access.task.id, res.user, `updated the checklist "${res.checklist.name}" to the latest SOP`);
  revalidatePath(SOP_PATH);
  return { success: true, checklist: toView(row) };
}

export async function addChecklistItemAction(
  checklistId: string,
  text: string,
  opts?: { isRequired?: boolean }
): Promise<Result<{ checklist: TaskChecklistView }>> {
  const res = await accessForChecklist(checklistId);
  if ("error" in res) return { success: false, error: res.error };
  if (!res.access.canManage) return { success: false, error: "Only managers can add checklist items" };

  const trimmed = (text || "").trim();
  if (!trimmed) return { success: false, error: "The item can't be empty" };
  if (trimmed.length > 500) return { success: false, error: "The item is too long (max 500 characters)" };

  const last = await d.taskChecklistItem.findFirst({
    where: { checklistId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  await d.taskChecklistItem.create({
    data: { checklistId, text: trimmed, position: (last?.position ?? -1) + 1, isRequired: !!opts?.isRequired },
  });

  const row = await d.taskChecklist.findUnique({ where: { id: checklistId }, include: CHECKLIST_INCLUDE });
  return { success: true, checklist: toView(row) };
}

export async function deleteChecklistItemAction(itemId: string): Promise<Result> {
  const res = await accessForItem(itemId);
  if ("error" in res) return { success: false, error: res.error as string };
  if (!res.access.canManage) return { success: false, error: "Only managers can remove checklist items" };

  await d.taskChecklistItem.delete({ where: { id: itemId } });
  return { success: true };
}

/**
 * "Select all" / "clear all" for one checklist. Ticking skips proof-required items that have no
 * proof link yet (they still need one each); already-ticked items keep who ticked them and when.
 */
export async function setAllChecklistItemsCheckedAction(
  checklistId: string,
  checked: boolean
): Promise<Result<{ checklist: TaskChecklistView; skippedForProof: number }>> {
  const res = await accessForChecklist(checklistId);
  if ("error" in res) return { success: false, error: res.error };
  if (!res.access.canCheck) return { success: false, error: "You can't tick items on this task" };

  const items: any[] = await d.taskChecklistItem.findMany({ where: { checklistId } });
  const blocked = checked ? items.filter((i) => !i.checked && i.requiresEvidence && !i.evidenceUrl) : [];
  const targets = items.filter((i) => i.checked !== checked && !blocked.includes(i));

  if (targets.length > 0) {
    await d.taskChecklistItem.updateMany({
      where: { id: { in: targets.map((i) => i.id) } },
      data: checked
        ? { checked: true, checkedById: res.user.id, checkedByName: res.user.name, checkedAt: new Date() }
        : { checked: false, checkedById: null, checkedByName: null, checkedAt: null },
    });
    await logTaskActivity(
      res.access.task.id,
      res.user,
      `${checked ? "ticked" : "unticked"} ${targets.length} item(s) in ${res.checklist.name}`
    );
  }

  const row = await d.taskChecklist.findUnique({ where: { id: checklistId }, include: CHECKLIST_INCLUDE });
  return { success: true, checklist: toView(row), skippedForProof: blocked.length };
}

/**
 * Ticks or unticks an item. An item flagged `requiresEvidence` can only be ticked with an
 * http(s) proof link.
 */
export async function setChecklistItemCheckedAction(
  itemId: string,
  checked: boolean,
  details?: { note?: string; evidenceUrl?: string }
): Promise<Result<{ item: TaskChecklistView["items"][number] }>> {
  const res = await accessForItem(itemId);
  if ("error" in res) return { success: false, error: res.error as string };
  if (!res.access.canCheck) return { success: false, error: "You can't tick items on this task" };

  const { item, user, access } = res;
  const note = details?.note !== undefined ? details.note.trim().slice(0, 1000) || null : item.note;
  let evidenceUrl = item.evidenceUrl;
  if (details?.evidenceUrl !== undefined) {
    if (details.evidenceUrl.trim() && !normalizeEvidenceUrl(details.evidenceUrl)) {
      return { success: false, error: "Enter a valid http(s) link as proof" };
    }
    evidenceUrl = normalizeEvidenceUrl(details.evidenceUrl);
  }
  if (checked && item.requiresEvidence && !evidenceUrl) {
    return { success: false, error: "This item needs a proof link before it can be ticked" };
  }

  const updated = await d.taskChecklistItem.update({
    where: { id: itemId },
    data: {
      checked,
      note,
      evidenceUrl,
      checkedById: checked ? user.id : null,
      checkedByName: checked ? user.name : null,
      checkedAt: checked ? new Date() : null,
    },
  });

  if (checked !== item.checked) {
    await logTaskActivity(
      access.task.id,
      user,
      `${checked ? "ticked" : "unticked"} "${item.text}" in ${res.checklist.name}`
    );
  }

  return {
    success: true,
    item: {
      id: updated.id,
      sourceItemId: updated.sourceItemId,
      text: updated.text,
      position: updated.position,
      isRequired: updated.isRequired,
      requiresEvidence: updated.requiresEvidence,
      isRemovedFromSop: updated.isRemovedFromSop,
      checked: updated.checked,
      checkedByName: updated.checkedByName,
      checkedAt: updated.checkedAt ? new Date(updated.checkedAt).toISOString() : null,
      note: updated.note,
      evidenceUrl: updated.evidenceUrl,
    },
  };
}
