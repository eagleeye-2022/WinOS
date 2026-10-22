import { describe, expect, it } from "vitest";
import {
  checklistProgress,
  normalizeEvidenceUrl,
  planChecklistSync,
  SyncTaskItem,
  SyncTemplateItem,
} from "@/features/sop-checklists/utils";

const tpl = (id: string, text: string, position: number, extra: Partial<SyncTemplateItem> = {}): SyncTemplateItem => ({
  id,
  text,
  position,
  isRequired: false,
  requiresEvidence: false,
  ...extra,
});

const task = (id: string, sourceItemId: string | null, text: string, position: number, extra: Partial<SyncTaskItem> = {}): SyncTaskItem => ({
  id,
  sourceItemId,
  text,
  position,
  isRequired: false,
  requiresEvidence: false,
  isRemovedFromSop: false,
  checked: false,
  ...extra,
});

describe("planChecklistSync", () => {
  it("does nothing when the task copy already matches the SOP", () => {
    const plan = planChecklistSync([tpl("a", "Step A", 0)], [task("x", "a", "Step A", 0)]);
    expect(plan).toEqual({ create: [], update: [], delete: [] });
  });

  it("adds template items the task doesn't have yet", () => {
    const plan = planChecklistSync([tpl("a", "Step A", 0), tpl("b", "Step B", 1)], [task("x", "a", "Step A", 0)]);
    expect(plan.create.map((c) => c.id)).toEqual(["b"]);
  });

  it("updates text and flags of unticked items", () => {
    const plan = planChecklistSync(
      [tpl("a", "Step A (new)", 0, { isRequired: true })],
      [task("x", "a", "Step A", 0)]
    );
    expect(plan.update).toEqual([{ id: "x", data: { text: "Step A (new)", isRequired: true } }]);
  });

  it("keeps the wording of ticked items but follows the SOP order", () => {
    const plan = planChecklistSync(
      [tpl("a", "Step A (new)", 3, { isRequired: true })],
      [task("x", "a", "Step A", 0, { checked: true })]
    );
    expect(plan.update).toEqual([{ id: "x", data: { position: 3 } }]);
  });

  it("deletes unticked items removed from the SOP, but flags ticked ones instead", () => {
    const plan = planChecklistSync(
      [],
      [task("x", "gone1", "Old", 0), task("y", "gone2", "Done old", 1, { checked: true })]
    );
    expect(plan.delete).toEqual(["x"]);
    expect(plan.update).toEqual([{ id: "y", data: { isRemovedFromSop: true } }]);
  });

  it("doesn't re-flag an item already marked as removed", () => {
    const plan = planChecklistSync([], [task("y", "gone", "Done old", 0, { checked: true, isRemovedFromSop: true })]);
    expect(plan).toEqual({ create: [], update: [], delete: [] });
  });

  it("never touches items added on the task itself", () => {
    const plan = planChecklistSync([tpl("a", "Step A", 0)], [task("x", "a", "Step A", 0), task("c", null, "Custom", 5)]);
    expect(plan).toEqual({ create: [], update: [], delete: [] });
  });
});

describe("checklistProgress", () => {
  it("counts done items and open required items", () => {
    expect(
      checklistProgress([
        { checked: true, isRequired: true },
        { checked: false, isRequired: true },
        { checked: false, isRequired: false },
      ])
    ).toEqual({ done: 1, total: 3, requiredOpen: 1 });
  });
});

describe("normalizeEvidenceUrl", () => {
  it("accepts http(s) links and rejects everything else", () => {
    expect(normalizeEvidenceUrl(" https://example.com/proof ")).toBe("https://example.com/proof");
    expect(normalizeEvidenceUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeEvidenceUrl("not a url")).toBeNull();
    expect(normalizeEvidenceUrl("")).toBeNull();
    expect(normalizeEvidenceUrl(null)).toBeNull();
  });
});
