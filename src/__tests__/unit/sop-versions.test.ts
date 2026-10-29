import { describe, expect, it } from "vitest";
import { diffSopSnapshots, sopDocToLines, sopStepLine, toSopSnapshot } from "@/features/sop-checklists/sop-versions";
import type { DocNode } from "@/features/sop-checklists/doc";

const p = (text: string): DocNode => ({ type: "paragraph", content: [{ type: "text", text }] });
const task = (text: string): DocNode => ({ type: "taskItem", attrs: { checked: false }, content: [p(text)] });

const doc: DocNode = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Before you start" }] },
    p("Collect the brief."),
    { type: "taskList", content: [task("Domain access"), task("Raw content")] },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [p("Owner")] },
            { type: "tableCell", content: [p("Dhruv")] },
          ],
        },
      ],
    },
  ],
};

describe("sopDocToLines", () => {
  it("reads headings, paragraphs, checkboxes and table rows in order", () => {
    expect(sopDocToLines(doc)).toEqual([
      "Before you start",
      "Collect the brief.",
      "☐ Domain access",
      "☐ Raw content",
      "Owner | Dhruv",
    ]);
  });
  it("is empty for an SOP without a stored document", () => {
    expect(sopDocToLines(null)).toEqual([]);
  });
});

describe("sopStepLine", () => {
  it("adds the required / proof flags", () => {
    expect(sopStepLine({ text: "Upload logo", isRequired: true, requiresEvidence: true })).toBe("Upload logo (required, proof)");
    expect(sopStepLine({ text: "Upload logo", isRequired: false, requiresEvidence: false })).toBe("Upload logo");
  });
});

describe("toSopSnapshot / diffSopSnapshots", () => {
  const v1 = toSopSnapshot({
    name: "Onboarding",
    description: "",
    category: "General",
    content: doc,
    items: [
      { text: "Domain access", isRequired: false, requiresEvidence: false },
      { text: "Raw content", isRequired: false, requiresEvidence: false },
    ],
  });

  it("ignores malformed stored rows", () => {
    expect(toSopSnapshot({ name: "X", category: "QA", content: "nope", items: [{ nope: 1 }] })).toEqual({
      name: "X",
      description: "",
      category: "QA",
      content: null,
      steps: [],
    });
  });

  it("shows a step marked required and a renamed SOP as changes", () => {
    const v2 = { ...v1, name: "Client Onboarding", steps: [{ ...v1.steps[0], isRequired: true }, v1.steps[1]] };
    const d = diffSopSnapshots(v1, v2);
    expect(d.name.filter((l) => l.kind !== "same")).toEqual([
      { kind: "removed", text: "Onboarding" },
      { kind: "added", text: "Client Onboarding" },
    ]);
    expect(d.steps.filter((l) => l.kind !== "same")).toEqual([
      { kind: "removed", text: "Domain access" },
      { kind: "added", text: "Domain access (required)" },
    ]);
    expect(d.document.every((l) => l.kind === "same")).toBe(true);
  });

  it("a first version shows everything as added", () => {
    const d = diffSopSnapshots(null, v1);
    expect(d.steps.map((l) => l.kind)).toEqual(["added", "added"]);
    expect(d.category).toEqual([{ kind: "added", text: "General" }]);
  });
});
