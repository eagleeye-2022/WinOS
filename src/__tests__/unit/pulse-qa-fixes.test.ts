import { describe, it, expect } from "vitest";
import { compOffDurationError, countLeaveDays } from "@/features/leave/leave-rules";
import { currentPeriod, overlapsPeriod, periodBounds, periodLabel } from "@/features/leave/components/period-nav";
import { defaultReasonFor } from "@/features/attendance/components/regularization-fields";
import { employeeCode } from "@/features/attendance/utils";
import { isSelfAction } from "@/features/attendance/team-scope";

describe("comp-off duration must match the hours worked", () => {
  it("refuses a full day for one hour of work", () => {
    expect(compOffDurationError("FULL_DAY", 60)).toMatch(/less than/);
    expect(compOffDurationError("FULL_DAY", 6 * 60)).toMatch(/full day needs at least 7h/);
  });
  it("accepts each duration at its threshold", () => {
    expect(compOffDurationError("FULL_DAY", 420)).toBeNull();
    expect(compOffDurationError("HALF_DAY", 210)).toBeNull();
    expect(compOffDurationError("QUARTER_DAY", 105)).toBeNull();
    expect(compOffDurationError("HALF_DAY", 209)).not.toBeNull();
  });
});

describe("leave day counting (what the apply form previews)", () => {
  const noSandwich = { sandwichPolicy: false, sandwichWeekends: false, sandwichHolidays: false };
  const sandwich = { sandwichPolicy: true, sandwichWeekends: true, sandwichHolidays: true };
  const range = { fromKey: "2026-11-06", toKey: "2026-11-09", durationType: "FULL_DAY" as const, requestedDays: 0 };

  it("Fri–Mon is 2 working days without the sandwich policy", () => {
    const r = countLeaveDays({ ...range, isHoliday: () => false, policy: noSandwich });
    expect("days" in r && r.days).toBe(2);
  });
  it("Fri–Mon is 4 days when the type sandwiches weekends", () => {
    const r = countLeaveDays({ ...range, isHoliday: () => false, policy: sandwich });
    expect("days" in r && r.days).toBe(4);
  });
  it("skips holidays", () => {
    const r = countLeaveDays({ ...range, isHoliday: (k) => k === "2026-11-09", policy: noSandwich });
    expect("days" in r && r.days).toBe(1);
  });
  it("a weekend-only range can't be taken", () => {
    const r = countLeaveDays({ ...range, fromKey: "2026-11-07", toKey: "2026-11-08", isHoliday: () => false, policy: noSandwich });
    expect("error" in r).toBe(true);
  });
});

describe("period navigator", () => {
  it("knows month and year bounds", () => {
    expect(periodBounds("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(periodBounds("2026")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
    expect(periodLabel("2026-11")).toBe("01 Nov – 30 Nov 2026");
  });
  it("matches ranges that touch the period", () => {
    expect(overlapsPeriod("2026-10-30", "2026-11-02", "2026-11")).toBe(true);
    expect(overlapsPeriod("2026-10-01", "2026-10-31", "2026-11")).toBe(false);
    expect(overlapsPeriod("2026-11-03", "2026-11-03", "2026")).toBe(true);
  });
  it("starts at the current month / year", () => {
    expect(currentPeriod("month")).toMatch(/^\d{4}-\d{2}$/);
    expect(currentPeriod("year")).toMatch(/^\d{4}$/);
  });
});

describe("regularization default reason follows the issue", () => {
  it("picks the matching reason", () => {
    expect(defaultReasonFor("Missing Check-out")).toBe("Forgot to check out");
    expect(defaultReasonFor("Missing Check-in & Check-out")).toBe("Forgot to check in and out");
    expect(defaultReasonFor("No attendance for the rest of the day")).toBe("Forgot to check in");
  });
  it("makes the employee pick when unclear", () => {
    expect(defaultReasonFor(undefined)).toBe("");
    expect(defaultReasonFor("Wrong times")).toBe("");
  });
});

describe("one employee code everywhere", () => {
  it("uses the real id, else one derived from the user id", () => {
    expect(employeeCode("EMP001", "cmabc1234")).toBe("EMP001");
    expect(employeeCode(null, "cmabc9vyt")).toBe("EMP-9VYT");
  });
});

describe("self-approval guard", () => {
  it("flags acting on your own record", () => {
    expect(isSelfAction({ id: "u1", role: "MANAGER" }, "u1")).toBe(true);
    expect(isSelfAction({ id: "u1", role: "MANAGER" }, "u2")).toBe(false);
  });
});
