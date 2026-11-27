import { describe, expect, it } from "vitest";
import {
  applyStatusWithRollup,
  reconcileRollup,
  replaceTaskWithRollup,
  rollupMessage,
} from "@/features/projects/utils/status-rollup";
import { isTaskDone, type TaskItem, type TaskStatus } from "@/features/projects/types";

const task = (code: string, status: string, subtasks: { code: string; status: string }[] = [], parentTaskId?: string) =>
  ({
    id: code,
    code,
    status,
    completionPercentage: isTaskDone(status) ? 100 : 0,
    parentTaskId,
    subtasks: subtasks.map((s) => ({ ...s, id: s.code, completed: isTaskDone(s.status) })),
  }) as unknown as TaskItem;

const byCode = (list: TaskItem[], code: string) => list.find((t) => t.code === code)!;

describe("applyStatusWithRollup", () => {
  const board = (s1: string, s2: string, s3: string, parent = "In Progress") => [
    task("P", parent, [
      { code: "P.1", status: s1 },
      { code: "P.2", status: s2 },
      { code: "P.3", status: s3 },
    ]),
    task("P.1", s1, [], "P"),
    task("P.2", s2, [], "P"),
    task("P.3", s3, [], "P"),
  ];

  it("closes the parent when its last open subtask is closed", () => {
    const { tasks, changes } = applyStatusWithRollup(board("Done", "Done", "Open"), { code: "P.3" }, "Done");
    expect(byCode(tasks, "P")).toMatchObject({ status: "Done", completionPercentage: 100 });
    expect(byCode(tasks, "P").subtasks?.find((s) => s.code === "P.3")).toMatchObject({ status: "Done", completed: true });
    expect(changes.map((c) => c.code)).toEqual(["P"]);
    expect(rollupMessage(changes)).toBe("All subtasks are done — P was closed too");
  });

  it("leaves the parent open while another subtask is still open", () => {
    const { tasks, changes } = applyStatusWithRollup(board("Done", "Open", "Open"), { code: "P.3" }, "Done");
    expect(byCode(tasks, "P").status).toBe("In Progress");
    expect(changes).toEqual([]);
  });

  it("reopens a closed parent when a subtask is reopened, with the same status", () => {
    const { tasks, changes } = applyStatusWithRollup(board("Done", "Done", "Done", "Done"), { code: "P.2" }, "In Progress");
    expect(byCode(tasks, "P")).toMatchObject({ status: "In Progress", completionPercentage: 0 });
    expect(changes.map((c) => c.code)).toEqual(["P"]);
    expect(rollupMessage(changes)).toBe("A subtask was reopened — P was reopened too");
  });

  it("rolls up through every level", () => {
    const list = [
      task("A", "Open", [{ code: "A.1", status: "Open" }]),
      task("A.1", "Open", [{ code: "A.1.1", status: "Open" }], "A"),
      task("A.1.1", "Open", [], "A.1"),
    ];
    const closed = applyStatusWithRollup(list, { code: "A.1.1" }, "Done");
    expect(closed.changes.map((c) => c.code)).toEqual(["A.1", "A"]);
    expect(byCode(closed.tasks, "A").status).toBe("Done");

    const reopened = applyStatusWithRollup(closed.tasks, { code: "A.1.1" }, "Open");
    expect(reopened.changes.map((c) => c.code)).toEqual(["A.1", "A"]);
    expect(byCode(reopened.tasks, "A").status).toBe("Open");
  });
});

describe("reconcileRollup", () => {
  it("undoes a parent the server didn't close (e.g. its SOP checklist isn't done)", () => {
    const list = [task("P", "In Progress", [{ code: "P.1", status: "Open" }]), task("P.1", "Open", [], "P")];
    const { tasks, changes } = applyStatusWithRollup(list, { code: "P.1" }, "Done");
    const settled = reconcileRollup(tasks, changes, [], "Done" as TaskStatus);
    expect(byCode(settled, "P")).toMatchObject({ status: "In Progress", completionPercentage: 0 });
    expect(byCode(settled, "P.1").status).toBe("Done");
  });
});

describe("replaceTaskWithRollup", () => {
  it("rolls up only when the status changed", () => {
    const list = [task("P", "Open", [{ code: "P.1", status: "Open" }]), task("P.1", "Open", [], "P")];
    const renamed = { ...list[1], title: "New name" } as TaskItem;
    expect(replaceTaskWithRollup(list, renamed, list[1]).changes).toEqual([]);
    const closed = { ...list[1], status: "Done" } as TaskItem;
    expect(replaceTaskWithRollup(list, closed, list[1]).changes.map((c) => c.code)).toEqual(["P"]);
  });
});
