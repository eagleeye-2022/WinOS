import { describe, expect, it } from "vitest";
import { rollUpParentDates } from "@/features/projects/utils/parent-date-rollup";
import type { TaskItem } from "@/features/projects/types";

type Sub = { code: string; startDate: string; dueDate: string };

const task = (code: string, startDate: string, dueDate: string, subtasks: Sub[] = [], parentTaskId?: string) =>
  ({ id: code, code, startDate, dueDate, parentTaskId, subtasks: subtasks.map((s) => ({ ...s, id: s.code })) }) as unknown as TaskItem;

describe("rollUpParentDates", () => {
  it("rolls up every parent — top-level and middle — from all subtasks below it", () => {
    const [top, middle, leaf] = rollUpParentDates([
      task("P", "2026-11-10", "2026-11-20", [{ code: "S1", startDate: "2026-11-12", dueDate: "2026-11-15" }]),
      task("S1", "2026-11-12", "2026-11-15", [{ code: "S2", startDate: "05/11/2026", dueDate: "30/11/2026" }], "P"),
      task("S2", "05/11/2026", "30/11/2026", [], "S1"),
    ]);
    expect([top.startDate, top.dueDate]).toEqual(["05/11/2026", "30/11/2026"]);
    expect([middle.startDate, middle.dueDate]).toEqual(["05/11/2026", "30/11/2026"]);
    expect([leaf.startDate, leaf.dueDate]).toEqual(["05/11/2026", "30/11/2026"]);
    // The parent's Subtasks table entry for S1 shows S1's rolled-up dates.
    expect(top.subtasks?.[0]).toMatchObject({ startDate: "05/11/2026", dueDate: "30/11/2026" });
  });

  it("uses the subtask's own row over a stale copy in the parent's list", () => {
    const [parent] = rollUpParentDates([
      task("P", "--", "--", [{ code: "S1", startDate: "--", dueDate: "06/11/2026" }]),
      task("S1", "--", "07/11/2026", [], "P"),
    ]);
    expect(parent.dueDate).toBe("07/11/2026");
    expect(parent.subtasks?.[0].dueDate).toBe("07/11/2026");
  });

  it("keeps the task's own due date when it is the latest", () => {
    const [parent] = rollUpParentDates([
      task("P", "2026-11-10", "2026-12-31", [{ code: "S1", startDate: "2026-11-12", dueDate: "2026-11-15" }]),
    ]);
    expect(parent.startDate).toBe("2026-11-12");
    expect(parent.dueDate).toBe("2026-12-31");
  });

  it("leaves tasks without dated subtasks unchanged", () => {
    const rows = [
      task("P", "2026-11-10", "--", [{ code: "S1", startDate: "--", dueDate: "--" }]),
      task("S1", "--", "--", [], "P"),
      task("Q", "2026-11-01", "2026-11-02"),
    ];
    expect(rollUpParentDates(rows)).toEqual(rows);
  });
});
