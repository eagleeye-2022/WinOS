import { describe, it, expect } from "vitest";
import {
  applyExceededRule,
  availableToApply,
  compOffCredit,
  compOffExpiry,
  countLeaveDays,
  validateLeaveRequest,
  type LeavePolicy,
} from "@/features/leave/leave-rules";
import { dateFromKey } from "@/features/attendance/utils";

// 2026-10-29 is a Thursday.
const TODAY = "2026-10-29";
const noHolidays = () => false;

function policy(over: Partial<LeavePolicy> = {}): LeavePolicy {
  return {
    name: "Casual Leave",
    isActive: true,
    effectiveDate: dateFromKey("2025-01-01")!,
    expiryDate: null,
    exceededRule: "MARK_AS_LOP",
    allowFullDay: true,
    allowHalfDay: true,
    allowQuarterDay: false,
    allowHourly: true,
    allowPastDays: true,
    pastDaysLimit: 7,
    pastDaysUnit: "DAYS",
    allowAdvanceDays: true,
    advanceDaysLimit: 90,
    advanceDaysUnit: "DAYS",
    // No notice by default so the other rules can be tested on "today"; the notice tests set it.
    minAdvanceNotice: 0,
    minAdvanceNoticeUnit: "DAYS",
    minLeavePerRequest: 0.5,
    maxLeavePerRequest: 10,
    maxConsecutiveDays: 15,
    applicableDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    sandwichPolicy: true,
    sandwichWeekends: true,
    sandwichHolidays: true,
    supportingDocPolicy: "REQUIRED_WHEN_EXCEEDS",
    docExceedsDays: 3,
    ...over,
  };
}

function validate(over: Partial<Parameters<typeof validateLeaveRequest>[0]> = {}) {
  return validateLeaveRequest({
    policy: policy(),
    fromKey: TODAY,
    toKey: TODAY,
    todayKey: TODAY,
    durationType: "FULL_DAY",
    days: 1,
    workingKeys: [TODAY],
    hasAttachment: false,
    ...over,
  });
}

describe("countLeaveDays", () => {
  const sandwich = { sandwichPolicy: true, sandwichWeekends: true, sandwichHolidays: true };

  it("counts working days in a week", () => {
    const r = countLeaveDays({ fromKey: "2026-10-26", toKey: "2026-10-30", durationType: "FULL_DAY", requestedDays: 0, isHoliday: noHolidays, policy: sandwich });
    expect(r).toEqual({ days: 5, workingKeys: ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"] });
  });

  it("charges a sandwiched weekend (Fri → Mon = 4 days)", () => {
    const r = countLeaveDays({ fromKey: "2026-10-30", toKey: "2026-11-02", durationType: "FULL_DAY", requestedDays: 0, isHoliday: noHolidays, policy: sandwich });
    expect("days" in r && r.days).toBe(4);
  });

  it("does not charge the weekend without the sandwich policy", () => {
    const r = countLeaveDays({
      fromKey: "2026-10-30",
      toKey: "2026-11-02",
      durationType: "FULL_DAY",
      requestedDays: 0,
      isHoliday: noHolidays,
      policy: { ...sandwich, sandwichPolicy: false },
    });
    expect("days" in r && r.days).toBe(2);
  });

  it("never charges weekends at the edges of the range", () => {
    const r = countLeaveDays({ fromKey: "2026-10-31", toKey: "2026-11-03", durationType: "FULL_DAY", requestedDays: 0, isHoliday: noHolidays, policy: sandwich });
    expect("days" in r && r.days).toBe(2); // Mon + Tue
  });

  it("skips holidays unless sandwiched", () => {
    const isHoliday = (k: string) => k === "2026-10-28";
    const r = countLeaveDays({
      fromKey: "2026-10-27",
      toKey: "2026-10-29",
      durationType: "FULL_DAY",
      requestedDays: 0,
      isHoliday,
      policy: { ...sandwich, sandwichHolidays: false },
    });
    expect("days" in r && r.days).toBe(2);
  });

  it("rejects a range that is only weekend", () => {
    const r = countLeaveDays({ fromKey: "2026-10-31", toKey: "2026-11-01", durationType: "FULL_DAY", requestedDays: 0, isHoliday: noHolidays, policy: sandwich });
    expect(r).toHaveProperty("error");
  });

  it("half day is 0.5 and must be a single working date", () => {
    expect(countLeaveDays({ fromKey: TODAY, toKey: TODAY, durationType: "HALF_DAY", requestedDays: 99, isHoliday: noHolidays, policy: sandwich })).toEqual({
      days: 0.5,
      workingKeys: [TODAY],
    });
    expect(
      countLeaveDays({ fromKey: TODAY, toKey: "2026-10-30", durationType: "HALF_DAY", requestedDays: 0.5, isHoliday: noHolidays, policy: sandwich })
    ).toHaveProperty("error");
    expect(
      countLeaveDays({ fromKey: "2026-10-31", toKey: "2026-10-31", durationType: "HALF_DAY", requestedDays: 0.5, isHoliday: noHolidays, policy: sandwich })
    ).toHaveProperty("error");
  });

  it("caps hourly leave at one day", () => {
    const r = countLeaveDays({ fromKey: TODAY, toKey: TODAY, durationType: "HOURLY", requestedDays: 3, isHoliday: noHolidays, policy: sandwich });
    expect("days" in r && r.days).toBe(1);
  });
});

describe("validateLeaveRequest", () => {
  it("accepts a normal request today", () => {
    expect(validate()).toBeNull();
  });
  it("rejects inactive types and disallowed durations", () => {
    expect(validate({ policy: policy({ isActive: false }) })).toMatch(/not active/);
    expect(validate({ policy: policy({ allowHalfDay: false }), durationType: "HALF_DAY", days: 0.5 })).toMatch(/Half-day/);
  });
  it("allows past dates for every leave type, however far back", () => {
    expect(validate({ fromKey: "2026-10-22", toKey: "2026-10-22", workingKeys: ["2026-10-22"] })).toBeNull(); // 7 days back
    expect(validate({ fromKey: "2026-10-21", toKey: "2026-10-21", workingKeys: ["2026-10-21"] })).toBeNull(); // beyond the old 7-day window
    expect(validate({ fromKey: "2026-01-05", toKey: "2026-01-05", workingKeys: ["2026-01-05"] })).toBeNull(); // months back
    // The type's own "allow past days" setting no longer blocks it.
    expect(validate({ policy: policy({ allowPastDays: false }), fromKey: "2026-10-28", toKey: "2026-10-28", workingKeys: ["2026-10-28"] })).toBeNull();
  });
  it("still refuses dates before the leave type's effective date", () => {
    expect(validate({ fromKey: "2024-12-31", toKey: "2024-12-31", workingKeys: ["2024-12-31"] })).toMatch(/can only be taken from/);
  });
  it("enforces the notice period — including leave that starts today", () => {
    const p = policy({ minAdvanceNotice: 3 }); // "apply at least 3 days before"
    expect(validate({ policy: p })).toMatch(/at least 3 days notice/); // today (0 days ahead)
    expect(validate({ policy: p, fromKey: "2026-10-30", toKey: "2026-10-30", workingKeys: ["2026-10-30"] })).toMatch(/notice/); // 1 day ahead
    expect(validate({ policy: p, fromKey: "2026-11-02", toKey: "2026-11-02", workingKeys: ["2026-11-02"] })).toBeNull(); // 4 days ahead
    // The message says the last day you could have applied.
    expect(validate({ policy: p, fromKey: "2026-10-30", toKey: "2026-10-30", workingKeys: ["2026-10-30"] })).toMatch(/on or before 2026-10-27/);
  });
  it("enforces the advance window for future leave", () => {
    expect(validate({ policy: policy({ advanceDaysLimit: 3 }), fromKey: "2026-11-05", toKey: "2026-11-05", workingKeys: ["2026-11-05"] })).toMatch(/in advance/);
    expect(validate({ policy: policy({ allowAdvanceDays: false }), fromKey: "2026-11-02", toKey: "2026-11-02", workingKeys: ["2026-11-02"] })).toMatch(/can't be applied in advance/);
  });
  it("converts notice in hours", () => {
    const p = policy({ minAdvanceNotice: 24, minAdvanceNoticeUnit: "HOURS" });
    expect(validate({ policy: p, fromKey: "2026-10-30", toKey: "2026-10-30", workingKeys: ["2026-10-30"] })).toBeNull();
  });
  it("enforces per-request and consecutive limits", () => {
    expect(validate({ days: 11 })).toMatch(/at most 10 days per request/);
    expect(validate({ policy: policy({ maxConsecutiveDays: 2 }), toKey: "2026-10-31", days: 2 })).toMatch(/in a row/);
    expect(validate({ policy: policy({ minLeavePerRequest: 1 }), durationType: "HALF_DAY", days: 0.5 })).toMatch(/at least 1 day/);
  });
  it("enforces applicable weekdays", () => {
    expect(validate({ policy: policy({ applicableDays: ["Mon"] }) })).toMatch(/only be taken on Mon/);
  });
  it("requires documents per policy", () => {
    expect(validate({ days: 4 })).toMatch(/supporting document/);
    expect(validate({ days: 4, hasAttachment: true })).toBeNull();
    expect(validate({ policy: policy({ supportingDocPolicy: "ALWAYS_REQUIRED" }) })).toMatch(/supporting document/);
  });
});

describe("applyExceededRule", () => {
  it("passes within balance", () => {
    expect(applyExceededRule({ policy: policy(), days: 2, available: 3 })).toEqual({ isLossOfPay: false, lopDays: 0 });
  });
  it("blocks when the rule is DO_NOT_ALLOW", () => {
    expect(applyExceededRule({ policy: policy({ exceededRule: "DO_NOT_ALLOW" }), days: 2, available: 1 })).toHaveProperty("error");
  });
  it("marks only the excess as LOP", () => {
    expect(applyExceededRule({ policy: policy(), days: 3, available: 1 })).toEqual({ isLossOfPay: true, lopDays: 2 });
    expect(applyExceededRule({ policy: policy(), days: 2, available: -1 })).toEqual({ isLossOfPay: true, lopDays: 2 });
  });
  it("allows going negative without LOP", () => {
    expect(applyExceededRule({ policy: policy({ exceededRule: "ALLOW_WITHOUT_LIMIT" }), days: 5, available: 0 })).toEqual({
      isLossOfPay: false,
      lopDays: 0,
    });
  });
  it("allows going over only until the year-end date", () => {
    const p = policy({ exceededRule: "ALLOW_UNTIL_YEAR_END" });
    // Before the leave type's year end → allowed.
    expect(applyExceededRule({ policy: p, days: 3, available: 1, toKey: "2026-11-20", yearEndKey: "2026-11-30" })).toEqual({
      isLossOfPay: false,
      lopDays: 0,
    });
    // After it → refused.
    expect(applyExceededRule({ policy: p, days: 3, available: 1, toKey: "2026-12-05", yearEndKey: "2026-11-30" })).toHaveProperty("error");
    // No year-end date set → 31 Dec of that year.
    expect(applyExceededRule({ policy: p, days: 3, available: 1, toKey: "2026-12-31" })).toEqual({ isLossOfPay: false, lopDays: 0 });
  });
});

describe("balances and comp-off", () => {
  it("counts pending days against the balance", () => {
    expect(availableToApply({ allocatedDays: 12, carriedForward: 2, adjustedDays: 1, bookedDays: 5, pendingDays: 3 })).toBe(7);
  });
  it("expires a comp-off on 31 December of the work date's year", () => {
    expect(compOffExpiry(dateFromKey("2026-10-25")!).toISOString().slice(0, 10)).toBe("2026-12-31");
    expect(compOffExpiry(dateFromKey("2026-01-01")!).toISOString().slice(0, 10)).toBe("2026-12-31");
    expect(compOffExpiry(dateFromKey("2026-12-31")!).toISOString().slice(0, 10)).toBe("2026-12-31");
  });
  it("credits by duration", () => {
    expect([compOffCredit("FULL_DAY"), compOffCredit("HALF_DAY"), compOffCredit("QUARTER_DAY")]).toEqual([1, 0.5, 0.25]);
  });
});
