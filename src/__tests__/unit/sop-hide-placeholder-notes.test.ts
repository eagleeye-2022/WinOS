import { describe, expect, it } from "vitest";
import { hidePlaceholderNotes, type DocNode } from "@/features/sop-checklists/doc";

const heading = (text: string): DocNode => ({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text }] });
const bullets = (...items: string[]): DocNode => ({
  type: "bulletList",
  content: items.map((t) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] })),
});
const task: DocNode = { type: "taskList", content: [{ type: "taskItem", attrs: { itemId: "a" }, content: [{ type: "paragraph" }] }] };

describe("hidePlaceholderNotes", () => {
  it("drops a Notes & references section holding only the PURPOSE placeholder", () => {
    const doc: DocNode = { type: "doc", content: [heading("Steps"), task, heading("Notes & references"), bullets("PURPOSE")] };
    expect(hidePlaceholderNotes(doc).content).toEqual([heading("Steps"), task]);
  });

  it("keeps a section with real notes, and returns the same doc when nothing changes", () => {
    const doc: DocNode = { type: "doc", content: [task, heading("Notes & references"), bullets("PURPOSE", "To guide the team")] };
    expect(hidePlaceholderNotes(doc)).toBe(doc);
  });

  it("only drops up to the next heading", () => {
    const doc: DocNode = { type: "doc", content: [heading("Notes & references"), bullets("PURPOSE"), heading("Next"), task] };
    expect(hidePlaceholderNotes(doc).content).toEqual([heading("Next"), task]);
  });
});
