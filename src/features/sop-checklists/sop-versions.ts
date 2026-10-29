// Pure helpers for SOP versions (no DB access, unit-tested). Safe on client and server.
import { diffLines, type DiffLine } from "@/features/notes/note-versions";
import { isDocNode, type DocNode } from "./doc";

export type SopVersionStep = { text: string; isRequired: boolean; requiresEvidence: boolean };

/** An SOP as it was at one version. */
export type SopVersionSnapshot = {
  name: string;
  description: string;
  category: string;
  /** The SOP document; null for SOPs saved before rich documents (then the steps are the SOP). */
  content: DocNode | null;
  steps: SopVersionStep[];
};

const asSteps = (value: unknown): SopVersionStep[] =>
  Array.isArray(value)
    ? value
        .filter((s) => s && typeof s === "object" && typeof (s as { text?: unknown }).text === "string")
        .map((s) => ({
          text: (s as { text: string }).text,
          isRequired: (s as { isRequired?: unknown }).isRequired === true,
          requiresEvidence: (s as { requiresEvidence?: unknown }).requiresEvidence === true,
        }))
    : [];

/** Normalises a stored version row (content / items as JSON) into a snapshot. */
export function toSopSnapshot(row: {
  name?: string | null;
  description?: string | null;
  category?: string | null;
  content?: unknown;
  items?: unknown;
}): SopVersionSnapshot {
  return {
    name: row.name ?? "",
    description: row.description ?? "",
    category: row.category ?? "General",
    content: isDocNode(row.content) ? row.content : null,
    steps: asSteps(row.items),
  };
}

const BLOCKS = new Set(["paragraph", "heading", "blockquote", "codeBlock"]);

function inlineText(node: DocNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return " ";
  return (node.content ?? []).map(inlineText).join("");
}

/**
 * The SOP document as readable lines: one per paragraph / heading, "☐ step" per checkbox,
 * "a | b | c" per table row. Used for "what changed" between versions.
 */
export function sopDocToLines(doc: DocNode | null): string[] {
  if (!doc) return [];
  const out: string[] = [];
  const walk = (node: DocNode) => {
    if (node.type === "taskItem") {
      const [first, ...rest] = node.content ?? [];
      const text = first ? inlineText(first).trim() : "";
      if (text) out.push(`☐ ${text}`);
      rest.forEach(walk);
      return;
    }
    if (node.type === "tableRow") {
      const cells = (node.content ?? []).map((c) => inlineText(c).trim().replace(/\s+/g, " "));
      if (cells.some(Boolean)) out.push(cells.join(" | "));
      return;
    }
    if (node.type && BLOCKS.has(node.type)) {
      const text = inlineText(node).trim();
      if (text) out.push(text);
      return;
    }
    (node.content ?? []).forEach(walk);
  };
  walk(doc);
  return out;
}

/** A step as one diff line, flags included — so marking a step Required shows as a change. */
export function sopStepLine(s: SopVersionStep): string {
  const flags = [s.isRequired && "required", s.requiresEvidence && "proof"].filter(Boolean);
  return flags.length ? `${s.text} (${flags.join(", ")})` : s.text;
}

/** Everything that changed between two versions of an SOP. */
export function diffSopSnapshots(
  before: SopVersionSnapshot | null,
  after: SopVersionSnapshot
): {
  name: DiffLine[];
  description: DiffLine[];
  category: DiffLine[];
  document: DiffLine[];
  steps: DiffLine[];
} {
  const one = (s: string | undefined) => (s ? [s] : []);
  return {
    name: diffLines(one(before?.name), one(after.name)),
    description: diffLines(one(before?.description), one(after.description)),
    category: diffLines(one(before?.category), one(after.category)),
    // Documents without a stored body (old SOPs) are compared by their steps only.
    document: diffLines(sopDocToLines(before?.content ?? null), sopDocToLines(after.content)),
    steps: diffLines((before?.steps ?? []).map(sopStepLine), after.steps.map(sopStepLine)),
  };
}
