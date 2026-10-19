import { describe, expect, it } from "vitest";
import { dateToProjectDueDate, effectiveDsmDueDate, projectDueDateToDate } from "@/lib/task-due-date";

describe("task due date conversions", () => {
  it("parses Srijan due dates (DD/MM/YYYY, YYYY-MM-DD) to UTC midnight", () => {
    expect(projectDueDateToDate("25/10/2026")?.toISOString()).toBe("2026-10-25T00:00:00.000Z");
    expect(projectDueDateToDate("2026-10-25")?.toISOString()).toBe("2026-10-25T00:00:00.000Z");
  });

  it("treats empty, '--' and impossible dates as no due date", () => {
    expect(projectDueDateToDate("--")).toBeNull();
    expect(projectDueDateToDate("")).toBeNull();
    expect(projectDueDateToDate(null)).toBeNull();
    expect(projectDueDateToDate("31/02/2026")).toBeNull();
    expect(projectDueDateToDate("asdf")).toBeNull();
  });

  it("formats a DSM date the way Srijan stores it", () => {
    expect(dateToProjectDueDate(new Date("2026-10-05T00:00:00.000Z"))).toBe("05/10/2026");
    expect(dateToProjectDueDate(null)).toBe("--");
  });

  it("round-trips", () => {
    expect(dateToProjectDueDate(projectDueDateToDate("07/03/2027"))).toBe("07/03/2027");
  });

  it("a linked DSM row shows the Srijan date, falling back to its own", () => {
    const own = new Date("2026-10-20T00:00:00.000Z");
    expect(effectiveDsmDueDate(own, "25/10/2026")?.toISOString()).toBe("2026-10-25T00:00:00.000Z");
    expect(effectiveDsmDueDate(own, "--")?.toISOString()).toBe("2026-10-20T00:00:00.000Z");
    expect(effectiveDsmDueDate(null, null)).toBeNull();
  });
});
