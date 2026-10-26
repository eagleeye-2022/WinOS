import { describe, expect, it } from "vitest";
import {
  diffLines,
  diffNoteSnapshots,
  noteHtmlToLines,
  sameNoteSnapshot,
  toNoteSnapshot,
} from "@/features/notes/note-versions";

const snap = (over: Partial<Parameters<typeof toNoteSnapshot>[0]> = {}) =>
  toNoteSnapshot({ title: "Plan", content: "<p>One</p><p>Two</p>", color: "#ffffff", deadline: null, checklist: [], ...over });

describe("noteHtmlToLines", () => {
  it("turns blocks and <br> into lines and decodes entities", () => {
    expect(noteHtmlToLines("<h2>Hi</h2><p>a&nbsp;&amp; b<br>c</p><ul><li>x</li></ul>")).toEqual(["Hi", "a & b", "c", "x"]);
  });
  it("handles empty content", () => {
    expect(noteHtmlToLines("")).toEqual([]);
  });
});

describe("diffLines", () => {
  it("marks removed and added lines around unchanged ones", () => {
    expect(diffLines(["a", "b", "c"], ["a", "x", "c"])).toEqual([
      { kind: "same", text: "a" },
      { kind: "removed", text: "b" },
      { kind: "added", text: "x" },
      { kind: "same", text: "c" },
    ]);
  });
  it("everything is added for a first version", () => {
    expect(diffLines([], ["a"])).toEqual([{ kind: "added", text: "a" }]);
  });
});

describe("sameNoteSnapshot", () => {
  it("is true for a save with no edits, whatever the stored shapes", () => {
    const stored = { ...snap(), deadline: null, checklist: [{ text: "Draft", checked: false }] };
    expect(sameNoteSnapshot(stored, { ...snap(), checklist: [{ text: "Draft", checked: false }] })).toBe(true);
  });
  it("is false when a checklist item is ticked", () => {
    expect(
      sameNoteSnapshot(
        { ...snap(), checklist: [{ text: "Draft", checked: false }] },
        { ...snap(), checklist: [{ text: "Draft", checked: true }] }
      )
    ).toBe(false);
  });
  it("compares deadlines as instants (Date vs ISO string)", () => {
    const at = "2026-10-26T09:00:00.000Z";
    expect(sameNoteSnapshot({ ...snap(), deadline: new Date(at) }, { ...snap(), deadline: at })).toBe(true);
  });
});

describe("diffNoteSnapshots", () => {
  it("reports content, checklist, deadline and colour changes", () => {
    const before = snap({ checklist: [{ text: "Draft", checked: false }] });
    const after = snap({
      content: "<p>One</p><p>Three</p>",
      color: "#fffbeb",
      deadline: "2026-10-30T00:00:00.000Z",
      checklist: [{ text: "Draft", checked: true }],
    });
    const d = diffNoteSnapshots(before, after);
    expect(d.content.filter((l) => l.kind !== "same")).toEqual([
      { kind: "removed", text: "Two" },
      { kind: "added", text: "Three" },
    ]);
    expect(d.checklist.filter((l) => l.kind !== "same")).toEqual([
      { kind: "removed", text: "☐ Draft" },
      { kind: "added", text: "☑ Draft" },
    ]);
    expect(d.deadlineChanged).toBe(true);
    expect(d.colorChanged).toBe(true);
    expect(d.title.every((l) => l.kind === "same")).toBe(true);
  });
  it("a first version shows everything as added and no colour change", () => {
    const d = diffNoteSnapshots(null, snap());
    expect(d.content).toEqual([
      { kind: "added", text: "One" },
      { kind: "added", text: "Two" },
    ]);
    expect(d.colorChanged).toBe(false);
  });
});
