/**
 * Pure helpers for SOP checklists — no server-only imports, safe from client and server.
 */

export interface SyncTemplateItem {
  id: string;
  text: string;
  position: number;
  isRequired: boolean;
  requiresEvidence: boolean;
}

export interface SyncTaskItem {
  id: string;
  sourceItemId: string | null;
  text: string;
  position: number;
  isRequired: boolean;
  requiresEvidence: boolean;
  isRemovedFromSop: boolean;
  checked: boolean;
}

export interface ChecklistSyncPlan {
  /** Template items the task copy doesn't have yet. */
  create: SyncTemplateItem[];
  update: { id: string; data: Partial<Omit<SyncTaskItem, "id" | "sourceItemId" | "checked">> }[];
  delete: string[];
}

/**
 * Works out how to bring one task's copy of an SOP in line with the current template, without
 * ever losing work someone already did on the task:
 * - template items missing from the task are added;
 * - unticked items take the template's latest text/flags/position;
 * - ticked items keep the text they were ticked against (only their position follows the SOP);
 * - items removed from the SOP are deleted if unticked, or kept and flagged if ticked;
 * - items added on the task itself (no `sourceItemId`) are never touched.
 */
export function planChecklistSync(
  templateItems: SyncTemplateItem[],
  taskItems: SyncTaskItem[]
): ChecklistSyncPlan {
  const plan: ChecklistSyncPlan = { create: [], update: [], delete: [] };
  const templateById = new Map(templateItems.map((t) => [t.id, t]));
  const linkedSourceIds = new Set<string>();

  for (const item of taskItems) {
    if (!item.sourceItemId) continue;
    linkedSourceIds.add(item.sourceItemId);
    const source = templateById.get(item.sourceItemId);

    if (!source) {
      if (item.checked) {
        if (!item.isRemovedFromSop) plan.update.push({ id: item.id, data: { isRemovedFromSop: true } });
      } else {
        plan.delete.push(item.id);
      }
      continue;
    }

    const data: ChecklistSyncPlan["update"][number]["data"] = {};
    if (item.position !== source.position) data.position = source.position;
    if (item.isRemovedFromSop) data.isRemovedFromSop = false;
    if (!item.checked) {
      if (item.text !== source.text) data.text = source.text;
      if (item.isRequired !== source.isRequired) data.isRequired = source.isRequired;
      if (item.requiresEvidence !== source.requiresEvidence) data.requiresEvidence = source.requiresEvidence;
    }
    if (Object.keys(data).length > 0) plan.update.push({ id: item.id, data });
  }

  for (const t of templateItems) {
    if (!linkedSourceIds.has(t.id)) plan.create.push(t);
  }

  return plan;
}

export function checklistProgress(items: { checked: boolean; isRequired: boolean }[]) {
  const done = items.filter((i) => i.checked).length;
  const requiredOpen = items.filter((i) => i.isRequired && !i.checked).length;
  return { done, total: items.length, requiredOpen };
}

/** Only http(s) links are accepted as evidence — never `javascript:` and the like. */
export function normalizeEvidenceUrl(raw: string | null | undefined): string | null {
  const s = (raw || "").trim();
  if (!s) return null;
  try {
    const url = new URL(s);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
