/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { isTaskDone } from "@/features/projects/types";
import { ActingUser, loadActingUser } from "../access";
import { applyChecklistSync } from "../sync";
import { recordSopEvent, recordSopEvents } from "../events";
import { docFromItems, DocChecklistItem, DocNode, extractChecklistItems, isDocNode, MAX_DOC_BYTES, MAX_DOC_ITEMS } from "../doc";
import { SopPickerOption, SopTemplate, SopTemplateInput } from "../types";
import { toSopSnapshot, type SopVersionSnapshot } from "../sop-versions";
import EED_SOP_LIBRARY from "../data/eed-sop-library.json";

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

/** Any signed-in user — creating an SOP is open to everyone; editing, archiving and deleting stay manager-only. */
async function requireSignedIn(): Promise<ActingUser | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  const user = await loadActingUser(session.user.id);
  if (!user) return { error: "Your account could not be found. Please sign in again." };
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

/**
 * The SOP picker on a task: active SOPs with their category and step count, for anyone signed in
 * (attaching still checks the user may work on that task).
 */
export async function getSopPickerOptionsAction(): Promise<SopPickerOption[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const rows = await d.sopChecklistTemplate.findMany({
    where: { isArchived: false },
    select: { id: true, name: true, category: true, _count: { select: { items: true } } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return rows.map((r: any) => ({ id: r.id, name: r.name, category: r.category, stepCount: r._count.items }));
}

/**
 * Read-only SOP library for any signed-in user (team members browse it at Srijan → SOPs/Checklists):
 * active SOPs with their documents. Creating, editing and archiving stay manager-only below.
 */
export async function getSopLibraryForViewerAction(): Promise<SopTemplate[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const user = await loadActingUser(session.user.id);
  if (!user) return [];
  const rows = await d.sopChecklistTemplate.findMany({
    where: { isArchived: false },
    include: TEMPLATE_INCLUDE,
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return rows.map(toSopTemplate);
}

/** Managers only — powers the SOP library and the project "Attach SOP to tasks" panel. */
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

/**
 * Saves the SOP as it is now under its current version number (see SopChecklistTemplateVersion).
 * A save that doesn't bump the version (a rename) updates that version's copy. Best-effort: a
 * failure is logged and never breaks the save itself.
 */
async function saveSopVersion(user: { id: string; name: string } | null, templateId: string): Promise<void> {
  try {
    const row = await d.sopChecklistTemplate.findUnique({
      where: { id: templateId },
      include: { items: { orderBy: { position: "asc" } } },
    });
    if (!row) return;
    const data = {
      name: row.name,
      description: row.description ?? "",
      category: row.category,
      content: row.content ?? undefined,
      items: (row.items || []).map((i: any) => ({
        text: i.text,
        isRequired: i.isRequired,
        requiresEvidence: i.requiresEvidence,
      })),
      userId: user?.id ?? row.createdById ?? null,
      userName: user?.name ?? row.createdByName ?? "Unknown",
    };
    await d.sopChecklistTemplateVersion.upsert({
      where: { templateId_version: { templateId, version: row.version } },
      create: { templateId, version: row.version, ...data },
      update: data,
    });
  } catch (err) {
    console.error("[saveSopVersion] failed for SOP", templateId, err);
  }
}

/**
 * Copy of a version from before version copies existed, made from the SOP as it was then (`row`,
 * read before an edit, or the SOP as it is now). Only creates it when it's missing. Best-effort.
 */
async function ensureSopVersionCopy(
  templateId: string,
  row: { version: number; name: string; description?: string | null; category: string; content?: unknown; createdById?: string | null; createdByName?: string | null; items: any[] }
): Promise<void> {
  try {
    await d.sopChecklistTemplateVersion.createMany({
      data: [
        {
          templateId,
          version: row.version,
          name: row.name,
          description: row.description ?? "",
          category: row.category,
          content: row.content ?? undefined,
          items: row.items.map((i: any) => ({ text: i.text, isRequired: i.isRequired, requiresEvidence: i.requiresEvidence })),
          userId: row.createdById ?? null,
          userName: row.createdByName || "Earlier version",
        },
      ],
      skipDuplicates: true,
    });
  } catch (err) {
    console.error("[ensureSopVersionCopy] failed for SOP", templateId, err);
  }
}

async function createTemplateRow(user: ActingUser, v: ValidInput) {
  return d.sopChecklistTemplate.create({
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
}

export async function createSopTemplateAction(input: SopTemplateInput): Promise<Result<{ template: SopTemplate }>> {
  const user = await requireSignedIn();
  if ("error" in user) return { success: false, error: user.error };
  const parsed = validateInput(input, new Set());
  if ("error" in parsed) return { success: false, error: parsed.error };

  const row = await createTemplateRow(user, parsed.value);
  await saveSopVersion(user, row.id);
  await recordSopEvent(user, {
    type: "TEMPLATE_CREATED",
    templateId: row.id,
    templateName: row.name,
    details: { steps: parsed.value.items.length, category: row.category },
  });
  revalidatePath(SOP_PATH);
  return { success: true, template: toSopTemplate(row) };
}

type LibraryEntry = { name: string; category: string; description: string; content: DocNode };

export interface SopLibraryImportPlan {
  create: { name: string; category: string; checkboxes: number }[];
  skip: string[];
  invalid: string[];
}

/**
 * Works out what importing the EED library would do — read-only: one SELECT of the existing SOP
 * names, everything else in memory. Shared by the dry run and the real import.
 */
async function planLibraryImport(): Promise<{ plan: SopLibraryImportPlan; toCreate: ValidInput[] }> {
  const existing: { name: string }[] = await d.sopChecklistTemplate.findMany({ select: { name: true } });
  const taken = new Set(existing.map((t) => t.name.trim().toLowerCase()));

  const plan: SopLibraryImportPlan = { create: [], skip: [], invalid: [] };
  const toCreate: ValidInput[] = [];
  for (const entry of EED_SOP_LIBRARY as LibraryEntry[]) {
    const key = entry.name.trim().toLowerCase();
    if (taken.has(key)) {
      plan.skip.push(entry.name);
      continue;
    }
    const parsed = validateInput(
      { name: entry.name, description: entry.description, category: entry.category, content: entry.content },
      new Set()
    );
    if ("error" in parsed) {
      plan.invalid.push(`${entry.name}: ${parsed.error}`);
      continue;
    }
    taken.add(key);
    toCreate.push(parsed.value);
    plan.create.push({ name: entry.name, category: entry.category, checkboxes: parsed.value.items.length });
  }
  return { plan, toCreate };
}

/** Dry run of "Import EED SOP library": what would be created / skipped. Writes nothing. */
export async function previewEedSopLibraryImportAction(): Promise<Result<{ plan: SopLibraryImportPlan }>> {
  const user = await requireManager();
  if ("error" in user) return { success: false, error: user.error };
  const { plan } = await planLibraryImport();
  return { success: true, plan };
}

/**
 * Creates the SOPs of the team's "Team EED - SOP, Checklist, Projects" sheet (converted into
 * data/eed-sop-library.json) that don't exist yet — matched by name, ignoring case, so running it
 * again only adds what's missing and never touches SOPs managers already edited. Only INSERTs into
 * SopChecklistTemplate / SopChecklistTemplateItem.
 */
export async function importEedSopLibraryAction(): Promise<Result<{ created: number; skipped: number; failed: string[] }>> {
  const user = await requireManager();
  if ("error" in user) return { success: false, error: user.error };

  const { plan, toCreate } = await planLibraryImport();
  let created = 0;
  const failed = [...plan.invalid];
  for (const v of toCreate) {
    try {
      const row = await createTemplateRow(user, v);
      created++;
      await saveSopVersion(user, row.id);
      await recordSopEvent(user, {
        type: "TEMPLATE_IMPORTED",
        templateId: row.id,
        templateName: row.name,
        details: { steps: v.items.length, category: row.category },
      });
    } catch (err) {
      console.error(`[importEedSopLibraryAction] Failed to create "${v.name}":`, err);
      failed.push(v.name);
    }
  }

  revalidatePath(SOP_PATH);
  return { success: true, created, skipped: plan.skip.length, failed };
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

  // Before the edit, make sure the version being replaced has its copy (SOPs saved before version
  // copies existed) — so "what changed" can compare against it. Then save the new state.
  if (itemsChanged || contentChanged) await ensureSopVersionCopy(id, existing);
  await saveSopVersion(user, id);

  const row = await d.sopChecklistTemplate.findUnique({ where: { id }, include: TEMPLATE_INCLUDE });
  const changed = v.items.filter((i) => {
    const old = existingById.get(i.id);
    return old && (old.text !== i.text || old.isRequired !== i.isRequired || old.requiresEvidence !== i.requiresEvidence);
  }).length;
  const metaChanged =
    existing.name !== v.name || existing.category !== v.category || existing.description !== v.description;
  if (itemsChanged || contentChanged || metaChanged) {
    await recordSopEvent(user, {
      type: "TEMPLATE_UPDATED",
      templateId: id,
      templateName: v.name,
      details: {
        version: row.version,
        added: v.items.filter((i) => !existingById.has(i.id)).length,
        removed: removed.length,
        changed,
        ...(existing.name !== v.name ? { renamedFrom: existing.name } : {}),
      },
    });
  }
  revalidatePath(SOP_PATH);
  return { success: true, template: toSopTemplate(row) };
}

/** Moves the SOP to another list (category) on the library board. Only the category changes — no new version. */
export async function moveSopTemplateAction(id: string, category: string): Promise<Result> {
  const user = await requireManager();
  if ("error" in user) return { success: false, error: user.error };

  const next = (category || "").trim().slice(0, 60);
  if (!next) return { success: false, error: "Choose a list" };
  const existing = await d.sopChecklistTemplate.findUnique({ where: { id }, select: { name: true, category: true } });
  if (!existing) return { success: false, error: "SOP not found" };
  if (existing.category === next) return { success: true };

  await d.sopChecklistTemplate.update({ where: { id }, data: { category: next } });
  await recordSopEvent(user, {
    type: "TEMPLATE_UPDATED",
    templateId: id,
    templateName: existing.name,
    details: { movedFrom: existing.category, movedTo: next },
  });
  revalidatePath(SOP_PATH);
  return { success: true };
}

export type SopVersionListItem = { version: number; userName: string; createdAt: string };

/**
 * The SOP's saved versions, newest first — the Versions tab of its Timeline (managers). Saves the
 * SOP's current state first if it has no copy yet (SOPs from before version history).
 */
export async function getSopVersionsAction(
  templateId: string
): Promise<Result<{ currentVersion: number; versions: SopVersionListItem[] }>> {
  const user = await requireManager();
  if ("error" in user) return { success: false, error: user.error };
  try {
    const row = await d.sopChecklistTemplate.findUnique({
      where: { id: templateId },
      include: { items: { orderBy: { position: "asc" } } },
    });
    if (!row) return { success: false, error: "This SOP no longer exists" };
    await ensureSopVersionCopy(templateId, row);

    const versions = await d.sopChecklistTemplateVersion.findMany({
      where: { templateId },
      orderBy: { version: "desc" },
      select: { version: true, userName: true, createdAt: true },
    });
    return {
      success: true,
      currentVersion: row.version,
      versions: versions.map((v: any) => ({
        version: v.version,
        userName: v.userName,
        createdAt: new Date(v.createdAt).toISOString(),
      })),
    };
  } catch (err) {
    console.error("[getSopVersionsAction] failed for SOP", templateId, err);
    return { success: false, error: "Couldn't load the versions. Please try again." };
  }
}

/** One saved version of an SOP plus the one before it ("what changed") — managers. */
export async function getSopVersionAction(
  templateId: string,
  version: number
): Promise<
  Result<{
    version: number;
    currentVersion: number;
    userName: string;
    createdAt: string;
    snapshot: SopVersionSnapshot;
    previous: SopVersionSnapshot | null;
  }>
> {
  const user = await requireManager();
  if ("error" in user) return { success: false, error: user.error };
  try {
    const [row, previous, template] = await Promise.all([
      d.sopChecklistTemplateVersion.findUnique({ where: { templateId_version: { templateId, version } } }),
      d.sopChecklistTemplateVersion.findFirst({
        where: { templateId, version: { lt: version } },
        orderBy: { version: "desc" },
      }),
      d.sopChecklistTemplate.findUnique({ where: { id: templateId }, select: { version: true } }),
    ]);
    if (!row) return { success: false, error: "That version wasn't found" };
    return {
      success: true,
      version: row.version,
      currentVersion: template?.version ?? row.version,
      userName: row.userName,
      createdAt: new Date(row.createdAt).toISOString(),
      snapshot: toSopSnapshot(row),
      previous: previous ? toSopSnapshot(previous) : null,
    };
  } catch (err) {
    console.error("[getSopVersionAction] failed for SOP", templateId, version, err);
    return { success: false, error: "Couldn't load that version. Please try again." };
  }
}

export async function setSopTemplateArchivedAction(id: string, archived: boolean): Promise<Result> {
  const user = await requireManager();
  if ("error" in user) return { success: false, error: user.error };

  const row = await d.sopChecklistTemplate.update({ where: { id }, data: { isArchived: archived } });
  await recordSopEvent(user, { type: archived ? "TEMPLATE_ARCHIVED" : "TEMPLATE_RESTORED", templateId: id, templateName: row.name });
  revalidatePath(SOP_PATH);
  return { success: true };
}

/** Deletes the SOP. Copies already on tasks stay (they become custom checklists). */
export async function deleteSopTemplateAction(id: string): Promise<Result> {
  const user = await requireManager();
  if ("error" in user) return { success: false, error: user.error };

  const row = await d.sopChecklistTemplate.delete({ where: { id } });
  await recordSopEvent(user, { type: "TEMPLATE_DELETED", templateId: id, templateName: row.name });
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
        select: {
          id: true,
          taskId: true,
          templateVersion: true,
          task: { select: { status: true, completionPercentage: true } },
        },
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

  await recordSopEvents(user, [
    {
      type: "TEMPLATE_PUSHED",
      templateId: id,
      templateName: template.name,
      details: { version: template.version, updated: open.length, skippedClosed: outdated.length - open.length },
    },
    ...open.map((c: any) => ({
      type: "CHECKLIST_SYNCED" as const,
      templateId: id,
      templateName: template.name,
      checklistId: c.id,
      taskId: c.taskId,
      details: { version: template.version, via: "push" },
    })),
  ]);
  revalidatePath(SOP_PATH);
  return { success: true, updated: open.length, skippedClosed: outdated.length - open.length };
}
