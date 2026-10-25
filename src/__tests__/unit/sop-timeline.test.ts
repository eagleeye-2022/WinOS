import { describe, expect, it } from "vitest";
import { describeSopEvent, SOP_EVENT_GROUPS, SOP_EVENT_TYPES, type SopEventView } from "@/features/sop-checklists/event-types";

const ev = (over: Partial<SopEventView>): SopEventView => ({
  id: "e1",
  type: "TEMPLATE_CREATED",
  templateId: "t1",
  templateName: "Blog Live Checklist",
  checklistId: null,
  taskId: null,
  taskCode: null,
  taskTitle: null,
  projectCode: null,
  itemText: null,
  details: null,
  actorId: "u1",
  actorName: "Mohit",
  createdAt: "2026-10-24T10:00:00.000Z",
  ...over,
});

describe("SOP timeline wording", () => {
  it("every event type belongs to exactly one filter group", () => {
    const grouped = Object.values(SOP_EVENT_GROUPS).flatMap((g) => g.types);
    expect([...grouped].sort()).toEqual([...SOP_EVENT_TYPES].sort());
  });

  it("says 'this SOP' in an SOP's own timeline and its name elsewhere", () => {
    const e = ev({ type: "CHECKLIST_ATTACHED", details: { via: "task", version: 2 } });
    expect(describeSopEvent(e, true)).toBe("picked this SOP for the task · v2");
    expect(describeSopEvent(e, false)).toBe('picked the SOP "Blog Live Checklist" for the task · v2');
  });

  it("describes edits, bulk picks and pushes with their numbers", () => {
    expect(describeSopEvent(ev({ type: "TEMPLATE_UPDATED", details: { version: 3, added: 2, removed: 1 } }), true)).toBe(
      "edited this SOP → v3 (2 steps added, 1 removed)"
    );
    expect(describeSopEvent(ev({ type: "CHECKLIST_ATTACHED", details: { via: "bulk" } }), true)).toBe(
      "picked this SOP for the task (bulk attach)"
    );
    expect(describeSopEvent(ev({ type: "TEMPLATE_PUSHED", details: { version: 4, updated: 1, skippedClosed: 0 } }), true)).toBe(
      "pushed v4 of this SOP to 1 task"
    );
  });

  it("describes item work and closing", () => {
    expect(describeSopEvent(ev({ type: "ITEM_ADDED", itemText: "Check footer links" }), true)).toBe(
      'added an extra item "Check footer links" on the task'
    );
    expect(describeSopEvent(ev({ type: "ITEM_CHECKED", itemText: "Flush Cache" }), true)).toBe('ticked "Flush Cache"');
    expect(
      describeSopEvent(ev({ type: "TASK_FORCE_CLOSED", details: { reason: "INCOMPLETE", done: 3, total: 5 } }), true)
    ).toBe("closed the task with the checklist incomplete (3/5, manager override)");
  });
});
