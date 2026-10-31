import type { DocNode } from "./doc";
import { DEPARTMENTS } from "@/features/users/constants";

export interface SopTemplateItem {
  id: string;
  text: string;
  position: number;
  isRequired: boolean;
  requiresEvidence: boolean;
}

export interface SopTemplate {
  id: string;
  name: string;
  description: string;
  /** The list it sits in, inside its department. */
  category: string;
  department: string;
  version: number;
  isArchived: boolean;
  createdByName: string | null;
  updatedAt: string;
  /** The SOP document; for SOPs saved before rich documents, a checkbox list built from `items`. */
  content: DocNode;
  /** One per checkbox in `content`, in reading order. */
  items: SopTemplateItem[];
  /** How many tasks this SOP is attached to, and how many of those copies are behind `version`. */
  attachedCount: number;
  outdatedCount: number;
}

/** The checklist items aren't sent — the server derives them from the document's checkboxes. */
export interface SopTemplateInput {
  name: string;
  description: string;
  /** The list it sits in, inside its department. */
  category: string;
  department: string;
  content: DocNode;
}

export interface TaskChecklistItemView {
  id: string;
  sourceItemId: string | null;
  text: string;
  position: number;
  isRequired: boolean;
  requiresEvidence: boolean;
  isRemovedFromSop: boolean;
  checked: boolean;
  checkedByName: string | null;
  checkedAt: string | null;
  note: string | null;
  evidenceUrl: string | null;
}

export interface TaskChecklistView {
  id: string;
  name: string;
  templateId: string | null;
  templateVersion: number;
  /** Current version of the SOP it came from, or null for a custom checklist. */
  latestTemplateVersion: number | null;
  /** SOP document snapshot; null → render `items` as a plain list (custom/older checklists). */
  content: DocNode | null;
  attachedByName: string | null;
  items: TaskChecklistItemView[];
}

export interface TaskChecklistsPayload {
  checklists: TaskChecklistView[];
  /** May attach/detach checklists and add/remove items (managers). */
  canManage: boolean;
  /** May tick items (managers, task owners, project users). */
  canCheck: boolean;
}

/** An SOP as offered in a task's checklist picker (anyone who can work on the task may pick). */
export interface SopPickerOption {
  id: string;
  name: string;
  department: string;
  list: string;
  stepCount: number;
}

/**
 * Why a task can't be closed yet (Srijan project tasks need a completed SOP checklist):
 * NO_CHECKLIST → "Please select a checklist", INCOMPLETE → "Please complete the checklist".
 */
export interface ChecklistCloseBlock {
  reason: "NO_CHECKLIST" | "INCOMPLETE";
  message: string;
  done: number;
  total: number;
  taskId: string;
  taskCode: string;
  /** For the task page link; null when the task has no project. */
  projectCode: string | null;
  /** Managers may close anyway. */
  canForce: boolean;
}

export interface ChecklistSummary {
  id: string;
  name: string;
  templateId: string | null;
  /** Its SOP has a newer version than this copy. */
  isBehind: boolean;
  done: number;
  total: number;
  requiredOpen: number;
}

export interface ProjectChecklistTask {
  id: string;
  code: string;
  title: string;
  status: string;
  phaseName: string | null;
  isSubtask: boolean;
  isDone: boolean;
  checklists: ChecklistSummary[];
}

export interface ProjectChecklistOverview {
  /** Code used in task links (`/projects/<code>/tasks/<taskCode>`); null when not visible. */
  projectCode: string | null;
  canManage: boolean;
  tasks: ProjectChecklistTask[];
}

/** One share (SopChecklistShare): a card (templateId) or list (department + listName) → a person or department. */
export interface SopShare {
  templateId: string | null;
  department: string | null;
  listName: string | null;
  targetUserId: string | null;
  targetDepartment: string | null;
}

export type SopShareTarget =
  | { kind: "sop"; templateId: string }
  | { kind: "list"; department: string; list: string };

export interface SopShareUserOption {
  id: string;
  name: string;
  department: string | null;
}

/** SOPs belong to the company's departments; inside one, to a list (SopChecklistTemplate.category). */
export const SOP_DEPARTMENTS = DEPARTMENTS;

/** For a new SOP when no department was chosen. */
export const DEFAULT_SOP_DEPARTMENT = "Operation";

/** For a new SOP when no list was chosen. */
export const DEFAULT_SOP_LIST = "General";
