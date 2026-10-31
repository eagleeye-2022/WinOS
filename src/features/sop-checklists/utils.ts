/**
 * Pure helpers for SOP checklists — no server-only imports, safe from client and server.
 */

import { isStandupRoutineTask, NAT_TASK_LIST_NAME } from "@/features/dsm/utils";
import { LEARNING_PROJECT_CATEGORY } from "@/features/whyfi/constants";
import { DEFAULT_SOP_DEPARTMENT, SOP_DEPARTMENTS, type SopShare } from "./types";

/** SOPs saved under the old categories, by the department of the old category. */
const LEGACY_CATEGORY_DEPARTMENT: Record<string, string> = {
  SEO: "Marketing",
  Design: "Operation",
  Development: "Operation",
  QA: "Operation",
  "Client Delivery": "Operation",
  General: DEFAULT_SOP_DEPARTMENT,
  // Team names briefly used as lists; they aren't departments.
  Creative: "Operation",
  Tech: "Operation",
  "EED Core": "Management",
};

/** Old-category SOPs whose department differs from their old category's (per the team's SOP sheet). */
const LEGACY_SOP_DEPARTMENT: Record<string, string> = {
  "Credential Checklist": "HR",
  "Things to Do Before Leaving Office": "HR",
  "Things to Do Before Starting Work": "HR",
  "Sales SOP: Proposal or Estimate Review": "Sales",
  "LNP Saturday SOP: Monthly Planning Session": "Management",
};

/**
 * The department of an SOP saved before departments, from its old category (SEO, Design, …). Used
 * when reading, without changing the row; saving or moving an SOP stores the department.
 */
export function sopDepartmentOf(category: string | null | undefined, name?: string | null): string {
  const c = (category || "").trim();
  if ((SOP_DEPARTMENTS as readonly string[]).includes(c)) return c;
  if (!(c in LEGACY_CATEGORY_DEPARTMENT)) return DEFAULT_SOP_DEPARTMENT;
  return LEGACY_SOP_DEPARTMENT[(name || "").trim()] ?? LEGACY_CATEGORY_DEPARTMENT[c];
}

/** An SOP's department: the saved one, or the one worked out for rows saved before departments. */
export function sopDepartmentFor(row: { department?: string | null; category?: string | null; name?: string | null }): string {
  return row.department || sopDepartmentOf(row.category, row.name);
}

/**
 * May a non-manager see this SOP? Yes if they created it, or if it, or the list it sits in, is
 * shared with them or their department.
 */
export function isSopVisibleTo(
  sop: { id: string; department: string; list: string; createdById?: string | null },
  viewer: { id: string; department?: string | null },
  shares: SopShare[]
): boolean {
  if (sop.createdById && sop.createdById === viewer.id) return true;
  return shares.some(
    (s) =>
      (s.templateId
        ? s.templateId === sop.id
        : s.department === sop.department && s.listName === sop.list) &&
      (s.targetUserId
        ? s.targetUserId === viewer.id
        : !!s.targetDepartment && s.targetDepartment === viewer.department)
  );
}

/**
 * Tasks that close without an SOP checklist: anything outside a Srijan project, WhyFi School
 * cards (LEARNING projects), NAT tasks, and the daily standup tasks (DSM / DSR / …).
 */
export function isChecklistExemptTask(task: {
  title?: string | null;
  taskListName?: string | null;
  phaseName?: string | null;
  projectId?: string | null;
  projectCategory?: string | null;
}): boolean {
  if (!task.projectId) return true;
  if (task.projectCategory === LEARNING_PROJECT_CATEGORY) return true;
  const nat = NAT_TASK_LIST_NAME.toLowerCase();
  if ([task.taskListName, task.phaseName].some((n) => (n || "").trim().toLowerCase() === nat)) return true;
  return isStandupRoutineTask(task.title);
}

/**
 * Closing rule for a (non-exempt) task, given each of its checklists' items: it needs at least one
 * checklist item, and every one ticked. Items removed from their SOP don't count.
 */
export function evaluateCloseGate(
  checklists: { checked: boolean; isRemovedFromSop?: boolean }[][]
): { reason: "NO_CHECKLIST" | "INCOMPLETE"; message: string; done: number; total: number } | null {
  const items = checklists.flat().filter((i) => !i.isRemovedFromSop);
  const done = items.filter((i) => i.checked).length;
  const total = items.length;
  if (total === 0) {
    return {
      reason: "NO_CHECKLIST",
      message:
        checklists.length === 0
          ? "Please select an SOP checklist for this task before closing it."
          : "This task's checklist has no items — select an SOP checklist before closing it.",
      done,
      total,
    };
  }
  if (done < total) {
    return {
      reason: "INCOMPLETE",
      message: `Please complete the task checklist before closing it (${done}/${total} done).`,
      done,
      total,
    };
  }
  return null;
}

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
