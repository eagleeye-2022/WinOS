import { describe, expect, it } from "vitest";
import { evaluateCloseGate, isChecklistExemptTask } from "@/features/sop-checklists/utils";

const item = (checked: boolean, isRemovedFromSop = false) => ({ checked, isRemovedFromSop });

describe("evaluateCloseGate", () => {
  it("asks to select a checklist when the task has none", () => {
    expect(evaluateCloseGate([])).toMatchObject({ reason: "NO_CHECKLIST", done: 0, total: 0 });
  });

  it("treats checklists with no items as no checklist", () => {
    expect(evaluateCloseGate([[]])).toMatchObject({ reason: "NO_CHECKLIST" });
  });

  it("asks to complete the checklist until every item is ticked", () => {
    const res = evaluateCloseGate([[item(true), item(false)], [item(true)]]);
    expect(res).toMatchObject({ reason: "INCOMPLETE", done: 2, total: 3 });
    expect(res?.message).toContain("2/3");
  });

  it("allows closing when every item is ticked", () => {
    expect(evaluateCloseGate([[item(true), item(true)]])).toBeNull();
  });

  it("ignores items removed from their SOP", () => {
    expect(evaluateCloseGate([[item(true), item(false, true)]])).toBeNull();
  });
});

describe("isChecklistExemptTask", () => {
  const project = { projectId: "p1", projectCategory: "CLIENT_DELIVERY", title: "Build header" };

  it("requires a checklist for ordinary Srijan project tasks", () => {
    expect(isChecklistExemptTask(project)).toBe(false);
  });

  it("exempts tasks outside a project and WhyFi School cards", () => {
    expect(isChecklistExemptTask({ ...project, projectId: null })).toBe(true);
    expect(isChecklistExemptTask({ ...project, projectCategory: "LEARNING" })).toBe(true);
  });

  it("exempts NAT tasks and the daily standup tasks", () => {
    expect(isChecklistExemptTask({ ...project, taskListName: "Not Aligned Task (NAT)" })).toBe(true);
    expect(isChecklistExemptTask({ ...project, phaseName: "not aligned task (nat)" })).toBe(true);
    expect(isChecklistExemptTask({ ...project, title: "DSM" })).toBe(true);
    expect(isChecklistExemptTask({ ...project, title: "DSR 24 Oct" })).toBe(true);
  });
});
