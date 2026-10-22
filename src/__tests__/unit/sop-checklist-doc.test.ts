import { describe, expect, it } from "vitest";
import {
  applyChecks,
  docFromItems,
  docItemIds,
  DocNode,
  extractChecklistItems,
} from "@/features/sop-checklists/doc";

const p = (text: string): DocNode => ({ type: "paragraph", content: [{ type: "text", text }] });
const item = (text: string, attrs: Record<string, unknown> = {}, nested?: DocNode): DocNode => ({
  type: "taskItem",
  attrs: { checked: false, ...attrs },
  content: nested ? [p(text), nested] : text ? [p(text)] : [{ type: "paragraph" }],
});
const list = (...items: DocNode[]): DocNode => ({ type: "taskList", content: items });
const doc = (...content: DocNode[]): DocNode => ({ type: "doc", content });

const ids = () => {
  let n = 0;
  return () => `new-${++n}`;
};

describe("extractChecklistItems", () => {
  it("collects every checkbox in reading order, including ones in tables and nested lists", () => {
    const d = doc(
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Prep" }] },
      list(item("Parent", {}, list(item("Child")))),
      {
        type: "table",
        content: [{ type: "tableRow", content: [{ type: "tableCell", content: [list(item("In a cell", { required: true }))] }] }],
      }
    );
    const { items } = extractChecklistItems(d, new Set(), ids());
    expect(items.map((i) => [i.text, i.position, i.isRequired])).toEqual([
      ["Parent", 0, false],
      ["Child", 1, false],
      ["In a cell", 2, true],
    ]);
  });

  it("keeps known ids, replaces unknown and duplicated ones, and writes them into the doc", () => {
    const d = doc(list(item("A", { itemId: "a" }), item("Pasted", { itemId: "foreign" }), item("Copy of A", { itemId: "a" })));
    const res = extractChecklistItems(d, new Set(["a"]), ids());
    expect(res.items.map((i) => i.id)).toEqual(["a", "new-1", "new-2"]);
    expect([...docItemIds(res.doc)]).toEqual(["a", "new-1", "new-2"]);
  });

  it("ignores empty checkboxes, reads the proof flag and clears ticks", () => {
    const d = doc(list(item("", { itemId: "x" }), item("Upload screenshot", { proof: true, checked: true })));
    const res = extractChecklistItems(d, new Set(["x"]), ids());
    expect(res.items).toEqual([
      { id: "new-1", text: "Upload screenshot", position: 0, isRequired: false, requiresEvidence: true },
    ]);
    const nodes = res.doc.content![0].content!;
    expect(nodes[0].attrs).toMatchObject({ itemId: null, checked: false });
    expect(nodes[1].attrs).toMatchObject({ itemId: "new-1", checked: false });
  });

  it("does not mutate the input document", () => {
    const d = doc(list(item("A")));
    const before = JSON.stringify(d);
    extractChecklistItems(d, new Set(), ids());
    expect(JSON.stringify(d)).toBe(before);
  });
});

describe("docFromItems / applyChecks", () => {
  it("builds a checkbox list that round-trips through extraction with the same ids", () => {
    const d = docFromItems([{ id: "a", text: "Step A", isRequired: true, requiresEvidence: false }]);
    const { items } = extractChecklistItems(d, new Set(["a"]), ids());
    expect(items).toEqual([{ id: "a", text: "Step A", position: 0, isRequired: true, requiresEvidence: false }]);
  });

  it("sets checked from the map and unticks everything else", () => {
    const d = doc(list(item("A", { itemId: "a" }), item("B", { itemId: "b", checked: true })));
    const out = applyChecks(d, new Map([["a", true]]));
    expect(out.content![0].content!.map((n) => n.attrs?.checked)).toEqual([true, false]);
  });
});
