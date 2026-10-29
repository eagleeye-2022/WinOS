import { describe, expect, it } from "vitest";
import { projectLinkKeys, syncReportTasksWithDsm, type ReportTaskRow } from "@/features/dsr/reporting";

const dsm = (...texts: string[]) => texts.map((text) => ({ text, priority: null }));

describe("syncReportTasksWithDsm", () => {
  it("adds tasks added to the DSM after the report was opened, unticked", () => {
    const report: ReportTaskRow[] = [
      { id: "a", text: "Task A", priority: null, completed: true },
      { id: "b", text: "Task B", priority: null, completed: false },
    ];
    expect(syncReportTasksWithDsm(report, dsm("Task A", "Task B", "Task C"))).toEqual([
      { id: "a", text: "Task A", priority: null, completed: true },
      { id: "b", text: "Task B", priority: null, completed: false },
      { text: "Task C", priority: null, completed: false },
    ]);
  });

  it("keeps ticks matched case/space-insensitively and follows the DSM order", () => {
    const report: ReportTaskRow[] = [
      { text: "task b ", priority: "P1", completed: true },
      { text: "Task A", priority: null, completed: false },
    ];
    expect(syncReportTasksWithDsm(report, [{ text: "Task A", priority: "P2" }, { text: "Task B", priority: null }])).toEqual([
      { text: "Task A", priority: "P2", completed: false },
      { text: "task b ", priority: "P1", completed: true },
    ]);
  });

  it("drops tasks deleted or renamed in the DSM, but keeps rows added after review", () => {
    const report: ReportTaskRow[] = [
      { text: "Old name", priority: null, completed: true },
      { text: "Removed", priority: null, completed: false },
      { text: "Added after review", priority: null, completed: false, addedAfterReview: true },
    ];
    expect(syncReportTasksWithDsm(report, dsm("New name"))).toEqual([
      { text: "New name", priority: null, completed: false },
      { text: "Added after review", priority: null, completed: false, addedAfterReview: true },
    ]);
  });

  it("leaves the report alone when the day has no DSM tasks", () => {
    const report: ReportTaskRow[] = [{ text: "Task A", priority: null, completed: true }];
    expect(syncReportTasksWithDsm(report, [])).toBe(report);
  });

  it("gives DSM tasks that share a text a row each", () => {
    expect(syncReportTasksWithDsm([], dsm("Manokalp", "manokalp"))).toEqual([
      { text: "Manokalp", priority: null, completed: false },
      { text: "manokalp", priority: null, completed: false },
    ]);
  });

  it("adds the second same-text task to a report that only had one, keeping the first one's tick", () => {
    const report: ReportTaskRow[] = [{ id: "a", text: "Manokalp", priority: null, completed: true }];
    expect(syncReportTasksWithDsm(report, dsm("Manokalp", "Manokalp"))).toEqual([
      { id: "a", text: "Manokalp", priority: null, completed: true },
      { text: "Manokalp", priority: null, completed: false },
    ]);
  });
});

describe("projectLinkKeys", () => {
  it("keys repeats of a text by occurrence", () => {
    expect(projectLinkKeys(["Manokalp", "ISPL", "manokalp ", "Manokalp"])).toEqual([
      "Manokalp",
      "ISPL",
      "manokalp #2",
      "Manokalp#3",
    ]);
  });
});
