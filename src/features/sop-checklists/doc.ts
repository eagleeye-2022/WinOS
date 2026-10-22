/**
 * SOP documents are TipTap JSON. Every checkbox (`taskItem` node) in one is a checklist item,
 * identified by its `itemId` attr. Pure helpers — no server-only imports, safe on both sides.
 */

export interface DocNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

export interface DocChecklistItem {
  id: string;
  text: string;
  position: number;
  isRequired: boolean;
  requiresEvidence: boolean;
}

export const EMPTY_DOC: DocNode = { type: "doc", content: [{ type: "paragraph" }] };

/** Rough cap on a stored document — pasted base64 images are what blow past it. */
export const MAX_DOC_BYTES = 1_000_000;
export const MAX_DOC_ITEMS = 300;

export function isDocNode(value: unknown): value is DocNode {
  return !!value && typeof value === "object" && (value as DocNode).type === "doc";
}

/** Plain text of a node, with block children separated by a space. */
function plainText(node: DocNode): string {
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return " ";
  return (node.content || [])
    .map(plainText)
    .join(node.type === "paragraph" || node.type === "heading" ? "" : " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A checkbox's own text — its paragraphs, not the checkboxes nested under it. */
function taskItemText(node: DocNode): string {
  return (node.content || [])
    .filter((c) => c.type !== "taskList")
    .map(plainText)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

/**
 * Walks the document, giving every non-empty checkbox an `itemId` and collecting them as items
 * in reading order. An existing id is kept only if it's in `allowedIds` (this SOP's own items)
 * and hasn't been seen earlier in the doc — so a checkbox pasted from another SOP, or duplicated
 * by copy-paste, gets a fresh id. Empty checkboxes lose their id and aren't items. Ticks in the
 * editor are dropped: the template itself is never "checked". Returns a new document.
 */
export function extractChecklistItems(
  doc: DocNode,
  allowedIds: Set<string>,
  newId: () => string
): { doc: DocNode; items: DocChecklistItem[] } {
  const items: DocChecklistItem[] = [];
  const seen = new Set<string>();

  const walk = (node: DocNode): DocNode => {
    const next: DocNode = { ...node };

    // The checkbox itself before its nested checkboxes, so positions follow reading order.
    if (node.type === "taskItem") {
      const text = taskItemText(node);
      const attrs: Record<string, unknown> = { ...(node.attrs || {}), checked: false };
      if (!text) {
        attrs.itemId = null;
      } else {
        const current = typeof attrs.itemId === "string" ? attrs.itemId : "";
        const id = current && allowedIds.has(current) && !seen.has(current) ? current : newId();
        seen.add(id);
        attrs.itemId = id;
        items.push({
          id,
          text,
          position: items.length,
          isRequired: attrs.required === true,
          requiresEvidence: attrs.proof === true,
        });
      }
      next.attrs = attrs;
    }

    if (node.content) next.content = node.content.map(walk);
    return next;
  };

  return { doc: walk(doc), items };
}

/** A plain checkbox list document for SOPs saved before rich documents existed. */
export function docFromItems(
  items: { id: string; text: string; isRequired: boolean; requiresEvidence: boolean }[]
): DocNode {
  if (items.length === 0) return EMPTY_DOC;
  return {
    type: "doc",
    content: [
      {
        type: "taskList",
        content: items.map((i) => ({
          type: "taskItem",
          attrs: { checked: false, itemId: i.id, required: i.isRequired, proof: i.requiresEvidence },
          content: [{ type: "paragraph", content: [{ type: "text", text: i.text }] }],
        })),
      },
    ],
  };
}

/** The document with each checkbox's `checked` set from `checkedById` (ids not in it → unticked). */
export function applyChecks(doc: DocNode, checkedById: Map<string, boolean>): DocNode {
  const walk = (node: DocNode): DocNode => {
    const next: DocNode = { ...node };
    if (node.content) next.content = node.content.map(walk);
    if (node.type === "taskItem") {
      const id = typeof node.attrs?.itemId === "string" ? node.attrs.itemId : "";
      next.attrs = { ...(node.attrs || {}), checked: id ? checkedById.get(id) === true : false };
    }
    return next;
  };
  return walk(doc);
}

/** Every checkbox `itemId` in the document. */
export function docItemIds(doc: DocNode): Set<string> {
  const ids = new Set<string>();
  const walk = (node: DocNode) => {
    if (node.type === "taskItem" && typeof node.attrs?.itemId === "string") ids.add(node.attrs.itemId);
    (node.content || []).forEach(walk);
  };
  walk(doc);
  return ids;
}
