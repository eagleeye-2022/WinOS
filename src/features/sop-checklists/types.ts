import type { DocNode } from "./doc";

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
  category: string;
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
  category: string;
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

export const SOP_CATEGORIES = [
  "General",
  "Client Delivery",
  "Development",
  "Design",
  "SEO",
  "Marketing",
  "QA",
] as const;
