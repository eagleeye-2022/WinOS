import { describe, expect, it, vi } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { sopDocExtensions } from "@/features/sop-checklists/editor/sop-extensions";
import { docFromItems, extractChecklistItems } from "@/features/sop-checklists/doc";

describe("SOP editor schema", () => {
  it("builds without duplicate-extension warnings, for the editor and the read-only view", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    getSchema(sopDocExtensions({ editable: true }));
    getSchema(sopDocExtensions({ editable: false, onReadOnlyChecked: () => false }));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("accepts an SOP document with flagged checkboxes, a table and nested checkboxes", () => {
    const schema = getSchema(sopDocExtensions({ editable: true }));
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Setup" }] },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false, itemId: "a", required: true, proof: true },
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Parent" }] },
                {
                  type: "taskList",
                  content: [
                    { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Child" }] }] },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "taskList",
                      content: [
                        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "In a cell" }] }] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const node = Node.fromJSON(schema, doc);
    node.check();
    // The editor round-trips the custom attrs, so checkbox ids and flags survive a save.
    const json = node.toJSON();
    expect(json.content[1].content[0].attrs).toMatchObject({ itemId: "a", required: true, proof: true });

    const ids = ["x", "y"];
    const { items } = extractChecklistItems(json, new Set(["a"]), () => ids.shift()!);
    expect(items.map((i) => i.text)).toEqual(["Parent", "Child", "In a cell"]);
  });

  it("accepts the plain checkbox list built for older SOPs", () => {
    const schema = getSchema(sopDocExtensions({ editable: false }));
    const doc = docFromItems([{ id: "a", text: "Step", isRequired: false, requiresEvidence: true }]);
    expect(() => Node.fromJSON(schema, doc).check()).not.toThrow();
  });
});
