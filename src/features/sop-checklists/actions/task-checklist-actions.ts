/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ActingUser, getTaskAccess, loadActingUser, logTaskActivity, TaskAccess } from "../access";
import { applyChecklistSync, sopCopyCreateData } from "../sync";
import { recordSopEvent } from "../events";
import { normalizeEvidenceUrl } from "../utils";
import { docFromItems, isDocNode } from "../doc";
import { ChecklistCloseBlock, TaskChecklistItemView, TaskChecklistsPayload, TaskChecklistView } from "../types";
import { checklistCloseBlock } from "../close-gate";

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

/** Timeline context for events on one task checklist. */
function onChecklist(checklist: { id: string; name: string; templateId: string | null; taskId: string }) {
  return { templateId: checklist.templateId, templateName: checklist.name, checklistId: checklist.id, taskId: checklist.taskId };
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
    items: (row.items || []).map(toItemView),
  };
}

function toItemView(i: any): TaskChecklistItemView {
  return {
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
  };
}

const CHECKLIST_INCLUDE = {
  items: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
  template: { select: { version: true } },
} as const;

/** Why this task can't be closed yet (for the gate popup), or null when it can. */
export async function getChecklistCloseBlockAction(taskId: string): Promise<ChecklistCloseBlock | null> {
  const user = await currentUser();
  if (!user) return null;
  const access = await getTaskAccess(taskId, user);
  if (!access) return null;
  const block = await checklistCloseBlock(access.task.id);
  // No "Close anyway" for anyone — managers complete the checklist like team members.
  return block ? { ...block, canForce: false } : null;
}

export async function getTaskChecklistsAction(taskId: string): Promise<TaskChecklistsPayload> {
  const empty: TaskChecklistsPayload = { checklists: [], canManage: false, canCheck: false };
  const user = await currentUser();
  if (!user) return empty;
  const access = await getTaskAccess(taskId, user);
  // Only people who may work on the task (managers included) see its checklists.
  if (!access || !access.canCheck) return empty;

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
  // Anyone who works on the task picks its SOP (removing one stays manager-only).
  if (!access.canCheck) return { success: false, error: "You can't add checklists to this task" };

  const template = await d.sopChecklistTemplate.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!template || template.isArchived) return { success: false, error: "This SOP isn't available any more" };

  const already = await d.taskChecklist.findFirst({ where: { taskId: access.task.id, templateId } });
  if (already) return { success: false, error: `"${template.name}" is already attached to this task` };

  const count = await d.taskChecklist.count({ where: { taskId: access.task.id } });
  let row;
  try {
    row = await d.taskChecklist.create({
      data: sopCopyCreateData(template, access.task.id, count, user),
      include: CHECKLIST_INCLUDE,
    });
  } catch (err: any) {
    // Two managers attaching the same SOP at once — the unique (taskId, templateId) index wins.
    if (err?.code === "P2002") return { success: false, error: `"${template.name}" is already attached to this task` };
    throw err;
  }

  await logTaskActivity(access.task.id, user, `attached the SOP checklist "${template.name}"`);
  await recordSopEvent(user, {
    type: "CHECKLIST_ATTACHED",
    ...onChecklist({ id: row.id, name: template.name, templateId, taskId: access.task.id }),
    details: { version: template.version, steps: template.items.length, via: "task" },
  });
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
  await recordSopEvent(user, {
    type: "CHECKLIST_CUSTOM_CREATED",
    ...onChecklist({ id: row.id, name: trimmed, templateId: null, taskId: access.task.id }),
    details: { name: trimmed },
  });
  return { success: true, checklist: toView(row) };
}

export async function detachChecklistAction(checklistId: string): Promise<Result> {
  const res = await accessForChecklist(checklistId);
  if ("error" in res) return { success: false, error: res.error };
  if (!res.access.canManage) return { success: false, error: "Only managers can remove checklists" };

  const items: { checked: boolean; isRemovedFromSop: boolean }[] = await d.taskChecklistItem.findMany({
    where: { checklistId },
    select: { checked: true, isRemovedFromSop: true },
  });
  await d.taskChecklist.delete({ where: { id: checklistId } });
  await logTaskActivity(res.access.task.id, res.user, `removed the checklist "${res.checklist.name}"`);
  const counted = items.filter((i) => !i.isRemovedFromSop);
  await recordSopEvent(res.user, {
    type: "CHECKLIST_REMOVED",
    ...onChecklist(res.checklist),
    details: { done: counted.filter((i) => i.checked).length, total: counted.length },
  });
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
  await recordSopEvent(res.user, {
    type: "CHECKLIST_SYNCED",
    ...onChecklist(res.checklist),
    details: { version: template.version, via: "task" },
  });
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
  await recordSopEvent(res.user, { type: "ITEM_ADDED", ...onChecklist(res.checklist), itemText: trimmed });

  const row = await d.taskChecklist.findUnique({ where: { id: checklistId }, include: CHECKLIST_INCLUDE });
  return { success: true, checklist: toView(row) };
}

/**
 * Renames an item added on the task itself. Items copied from an SOP are edited in the SOP (and
 * reach the task through "update to latest"), so a task's copy never silently drifts from it.
 */
export async function updateChecklistItemTextAction(
  itemId: string,
  text: string
): Promise<Result<{ item: TaskChecklistView["items"][number] }>> {
  const res = await accessForItem(itemId);
  if ("error" in res) return { success: false, error: res.error as string };
  if (!res.access.canManage) return { success: false, error: "Only managers can edit checklist items" };
  if (res.item.sourceItemId) return { success: false, error: "Edit this step in its SOP, then update the task to it" };

  const trimmed = (text || "").trim();
  if (!trimmed) return { success: false, error: "The item can't be empty" };
  if (trimmed.length > 500) return { success: false, error: "The item is too long (max 500 characters)" };

  const updated = await d.taskChecklistItem.update({ where: { id: itemId }, data: { text: trimmed } });
  if (trimmed !== res.item.text) {
    await recordSopEvent(res.user, {
      type: "ITEM_EDITED",
      ...onChecklist(res.checklist),
      itemText: trimmed,
      details: { from: res.item.text },
    });
  }
  return { success: true, item: toItemView(updated) };
}

export async function deleteChecklistItemAction(itemId: string): Promise<Result> {
  const res = await accessForItem(itemId);
  if ("error" in res) return { success: false, error: res.error as string };
  if (!res.access.canManage) return { success: false, error: "Only managers can remove checklist items" };

  await d.taskChecklistItem.delete({ where: { id: itemId } });
  await recordSopEvent(res.user, { type: "ITEM_REMOVED", ...onChecklist(res.checklist), itemText: res.item.text });
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
    await recordSopEvent(res.user, {
      type: checked ? "ITEMS_ALL_CHECKED" : "ITEMS_ALL_UNCHECKED",
      ...onChecklist(res.checklist),
      details: { count: targets.length, skippedForProof: blocked.length },
    });
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
  const noteChanged = note !== item.note || evidenceUrl !== item.evidenceUrl;
  if (checked !== item.checked || noteChanged) {
    await recordSopEvent(user, {
      type: checked !== item.checked ? (checked ? "ITEM_CHECKED" : "ITEM_UNCHECKED") : "ITEM_NOTE_UPDATED",
      ...onChecklist(res.checklist),
      itemText: item.text,
      details: noteChanged ? { note, evidenceUrl } : null,
    });
  }

  return {
    success: true,
    item: toItemView(updated),
  };
}
