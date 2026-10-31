import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { sopDocExtensions } from "@/features/sop-checklists/editor/sop-extensions";
import { DocNode, extractChecklistItems, MAX_DOC_BYTES, MAX_DOC_ITEMS } from "@/features/sop-checklists/doc";
import { SOP_DEPARTMENTS } from "@/features/sop-checklists/types";
import library from "@/features/sop-checklists/data/eed-sop-library.json";

const entries = library as { source: string; name: string; category: string; description: string; content: DocNode }[];
const schema = getSchema(sopDocExtensions({ editable: true }));

describe("EED SOP library (imported from the team's Google Sheet)", () => {
  it("has unique names and known departments", () => {
    const names = entries.map((e) => e.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const e of entries) expect(SOP_DEPARTMENTS as readonly string[]).toContain(e.category);
  });

  it.each(entries.map((e) => [e.name, e] as const))("%s is a valid SOP document", (_name, e) => {
    // Loads in the editor schema exactly as stored.
    expect(() => Node.fromJSON(schema, e.content).check()).not.toThrow();
    // And passes the same rules as saving it from the SOP page.
    expect(JSON.stringify(e.content).length).toBeLessThan(MAX_DOC_BYTES);
    let n = 0;
    const { items } = extractChecklistItems(e.content, new Set(), () => `id-${++n}`);
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(MAX_DOC_ITEMS);
    expect(e.name.length).toBeLessThanOrEqual(120);
  });
});
