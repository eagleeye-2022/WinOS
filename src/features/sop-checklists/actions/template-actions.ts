/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { isTaskDone } from "@/features/projects/types";
import { ActingUser, loadActingUser } from "../access";
import { applyChecklistSync } from "../sync";
import { docFromItems, DocChecklistItem, DocNode, extractChecklistItems, isDocNode, MAX_DOC_BYTES, MAX_DOC_ITEMS } from "../doc";
import { SopTemplate, SopTemplateInput } from "../types";

const d = db as any;

const SOP_PATH = "/projects/sop-checklists";

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

async function requireManager(): Promise<ActingUser | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  const user = await loadActingUser(session.user.id);
  if (!user) return { error: "Your account could not be found. Please sign in again." };
  if (!user.isManager) return { error: "Only managers can manage SOP checklists" };
  return user;
}

interface ValidInput {
  name: string;
  description: string;
  category: string;
  content: DocNode;
  items: DocChecklistItem[];
}

/**
 * Checks the input and derives the checklist items from the document's checkboxes. `allowedIds`
 * are the SOP's current item ids — a checkbox keeps its id (and so its link to task copies) only
 * if it's one of them.
 */
function validateInput(input: SopTemplateInput, allowedIds: Set<string>): { value: ValidInput } | { error: string } {
  const name = (input.name || "").trim();
  if (!name) return { error: "Give the SOP a name" };
  if (name.length > 120) return { error: "The SOP name is too long (max 120 characters)" };

  if (!isDocNode(input.content)) return { error: "The SOP document is invalid — reload and try again" };
  if (JSON.stringify(input.content).length > MAX_DOC_BYTES) {
    return { error: "The SOP is too large. Pasted images may be embedded — upload them with the image button instead." };
  }

  const { doc, items } = extractChecklistItems(input.content, allowedIds, randomUUID);
  if (items.length === 0) return { error: "Add at least one checkbox — those are the steps people tick on a task" };
  if (items.length > MAX_DOC_ITEMS) return { error: `An SOP can have at most ${MAX_DOC_ITEMS} checkboxes` };

  return {
    value: {
      name,
      description: (input.description || "").trim().slice(0, 2000),
      category: (input.category || "General").trim().slice(0, 60) || "General",
      content: doc,
      items,
    },
  };
}

const TEMPLATE_INCLUDE = {
  items: { orderBy: { position: "asc" } },
  taskChecklists: { select: { templateVersion: true } },
} as const;

function toSopTemplate(row: any): SopTemplate {
  const copies: { templateVersion: number }[] = row.taskChecklists || [];
  const items = (row.items || []).map((i: any) => ({
    id: i.id,
    text: i.text,
    position: i.position,
    isRequired: i.isRequired,
    requiresEvidence: i.requiresEvidence,
  }));
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    version: row.version,
    isArchived: row.isArchived,
    createdByName: row.createdByName,
    updatedAt: new Date(row.updatedAt).toISOString(),
    content: isDocNode(row.content) ? row.content : docFromItems(items),
    items,
    attachedCount: copies.length,
    outdatedCount: copies.filter((c) => c.templateVersion < row.version).length,
  };
}

/** Managers only — powers the SOP library and the "attach SOP" picker on tasks. */
export async function getSopTemplatesAction(opts?: { includeArchived?: boolean }): Promise<SopTemplate[]> {
  const user = await requireManager();
  if ("error" in user) return [];

  const rows = await d.sopChecklistTemplate.findMany({
    where: opts?.includeArchived ? {} : { isArchived: false },
    include: TEMPLATE_INCLUDE,
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return rows.map(toSopTemplate);
}

export async function createSopTemplateAction(input: SopTemplateInput): Promise<Result<{ template: SopTemplate }>> {
  const user = await requireManager();
  if ("error" in user) return { success: false, error: user.error };
  const parsed = validateInput(input, new Set());
  if ("error" in parsed) return { success: false, error: parsed.error };
  const v = parsed.value;

  const row = await d.sopChecklistTemplate.create({
    data: {
      name: v.name,
      description: v.description,
      category: v.category,
      content: v.content as any,
      createdById: user.id,
      createdByName: user.name,
      items: {
        create: v.items.map((i) => ({
          id: i.id,
          text: i.text,
          position: i.position,
          isRequired: i.isRequired,
          requiresEvidence: i.requiresEvidence,
        })),
      },
    },
    include: TEMPLATE_INCLUDE,
  });

  revalidatePath(SOP_PATH);
  return { success: true, template: toSopTemplate(row) };
}

/**
 * Saves the SOP document and re-derives its items from the checkboxes, diffing by id (not
 * delete-and-recreate) so ids stay stable — task copies point back at them through
 * `TaskChecklistItem.sourceItemId`. The version is bumped only when the document or its items
 * actually change; tasks pick the change up via "push update".
 */
export async function updateSopTemplateAction(
  id: string,
  input: SopTemplateInput
): Promise<Result<{ template: SopTemplate }>> {
  const user = await requireManager();
  if ("error" in user) return { success: false, error: user.error };

  const existing = await d.sopChecklistTemplate.findUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!existing) return { success: false, error: "This SOP no longer exists" };

  const existingById = new Map<string, any>(existing.items.map((i: any) => [i.id, i]));
  const parsed = validateInput(input, new Set(existingById.keys()));
  if ("error" in parsed) return { success: false, error: parsed.error };
  const v = parsed.value;

  const keptIds = new Set(v.items.map((i) => i.id));
  const removed = existing.items.filter((i: any) => !keptIds.has(i.id)).map((i: any) => i.id);

  const itemsChanged =
    removed.length > 0 ||
    v.items.some((i) => {
      const old = existingById.get(i.id);
      return (
        !old ||
        old.text !== i.text ||
        old.position !== i.position ||
        old.isRequired !== i.isRequired ||
        old.requiresEvidence !== i.requiresEvidence
      );
    });
  const contentChanged = JSON.stringify(existing.content ?? null) !== JSON.stringify(v.content);

  await d.$transaction(async (tx: any) => {
    if (removed.length > 0) {
      await tx.sopChecklistTemplateItem.deleteMany({ where: { id: { in: removed }, templateId: id } });
    }
    for (const i of v.items) {
      const data = { text: i.text, position: i.position, isRequired: i.isRequired, requiresEvidence: i.requiresEvidence };
      if (existingById.has(i.id)) await tx.sopChecklistTemplateItem.update({ where: { id: i.id }, data });
      else await tx.sopChecklistTemplateItem.create({ data: { ...data, id: i.id, templateId: id } });
    }
    await tx.sopChecklistTemplate.update({
      where: { id },
      data: {
        name: v.name,
        description: v.description,
        category: v.category,
        content: v.content as any,
        ...(itemsChanged || contentChanged ? { version: { increment: 1 } } : {}),
      },
    });
  });

  const row = await d.sopChecklistTemplate.findUnique({ where: { id }, include: TEMPLATE_INCLUDE });
  revalidatePath(SOP_PATH);
  return { success: true, template: toSopTemplate(row) };
}

export async function setSopTemplateArchivedAction(id: string, archived: boolean): Promise<Result> {
  const user = await requireManager();
  if ("error" in user) return { success: false, error: user.error };

  await d.sopChecklistTemplate.update({ where: { id }, data: { isArchived: archived } });
  revalidatePath(SOP_PATH);
  return { success: true };
}

/** Deletes the SOP. Copies already on tasks stay (they become custom checklists). */
export async function deleteSopTemplateAction(id: string): Promise<Result> {
  const user = await requireManager();
  if ("error" in user) return { success: false, error: user.error };

  await d.sopChecklistTemplate.delete({ where: { id } });
  revalidatePath(SOP_PATH);
  return { success: true };
}

/**
 * Brings every out-of-date copy of this SOP on an open task up to the current version (see
 * `planChecklistSync` for what is and isn't changed). Copies on done/closed tasks are left as
 * the record of what was checked.
 */
export async function pushSopTemplateUpdateAction(
  id: string
): Promise<Result<{ updated: number; skippedClosed: number }>> {
  const user = await requireManager();
  if ("error" in user) return { success: false, error: user.error };

  const template = await d.sopChecklistTemplate.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" } },
      taskChecklists: {
        select: { id: true, templateVersion: true, task: { select: { status: true, completionPercentage: true } } },
      },
    },
  });
  if (!template) return { success: false, error: "This SOP no longer exists" };

  const outdated = template.taskChecklists.filter((c: any) => c.templateVersion < template.version);
  const open = outdated.filter((c: any) => !isTaskDone(c.task?.status, false, c.task?.completionPercentage));
  const content = isDocNode(template.content) ? template.content : docFromItems(template.items);

  for (const c of open) {
    await d.$transaction((tx: any) => applyChecklistSync(tx, c.id, template.items, template.version, content));
  }

  revalidatePath(SOP_PATH);
  return { success: true, updated: open.length, skippedClosed: outdated.length - open.length };
}
