import { describe, expect, it } from "vitest";
import { removeTaskFromList } from "@/features/projects/utils/remove-task-from-list";
import type { TaskItem } from "@/features/projects/types";

// Rows are keyed by code; subtask entries carry the db id ("db-<code>"), as loadTasks builds them.
const row = (code: string, subCodes: string[] = [], parentTaskId?: string) =>
  ({
    id: code,
    code,
    parentTaskId,
    subtasks: subCodes.map((c) => ({ id: `db-${c}`, code: c })),
  }) as unknown as TaskItem;

const list = () => [
  row("T1", ["T1.1"]),
  row("T1.1", ["T1.1.1"], "db-T1"),
  row("T1.1.1", [], "db-T1.1"),
  row("T2"),
];

describe("removeTaskFromList", () => {
  it("drops a subtask's row, everything under it, and its entry in the parent's list", () => {
    const after = removeTaskFromList(list(), "T1.1");
    expect(after.map((t) => t.code)).toEqual(["T1", "T2"]);
    expect(after[0].subtasks).toEqual([]);
  });

  it("works with the subtask entry's db id (the Subtasks table delete)", () => {
    const after = removeTaskFromList(list(), "db-T1.1.1");
    expect(after.map((t) => t.code)).toEqual(["T1", "T1.1", "T2"]);
    expect(after[1].subtasks).toEqual([]);
  });

  it("deleting a top task removes its whole tree and leaves others alone", () => {
    expect(removeTaskFromList(list(), "T1").map((t) => t.code)).toEqual(["T2"]);
  });
});
