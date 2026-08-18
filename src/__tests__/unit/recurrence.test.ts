import { describe, it, expect } from "vitest";
import {
  expandOccurrences,
  describeRule,
  matchPresetKey,
  serializeRule,
  parseRule,
  presetDaily,
  presetWeeklyOnStart,
  presetEveryWeekday,
  presetMonthlyOnDate,
  presetMonthlyOnDay,
  presetYearly,
  localDateInputValue,
  type RecurrenceRule,
} from "@/features/calendar/recurrence";

// Tuesday, 18 Aug 2026, 5:00-6:00 PM IST — matches the screenshot's "Weekly on Tuesday" /
// "Monthly on 18th" / "Yearly on August 18th" presets.
const START = new Date("2026-08-18T17:00:00+05:30");
const END = new Date("2026-08-18T18:00:00+05:30");

function occDates(occs: { start: Date }[]): string[] {
  return occs.map((o) => localDateInputValue(o.start));
}

describe("recurrence presets & labels", () => {
  it("describes presets exactly like the mock dropdown", () => {
    expect(describeRule(null, START)).toBe("Does not repeat");
    expect(describeRule(presetDaily(), START)).toBe("Daily");
    expect(describeRule(presetWeeklyOnStart(START), START)).toBe("Weekly on Tuesday");
    expect(describeRule(presetEveryWeekday(), START)).toBe("Every weekday (Monday to Friday)");
    expect(describeRule(presetMonthlyOnDate(), START)).toBe("Monthly on the 18th");
    expect(describeRule(presetMonthlyOnDay(), START)).toBe("Monthly on the third Tuesday");
    expect(describeRule(presetYearly(), START)).toBe("Yearly on August 18th");
  });

  it("matchPresetKey identifies presets and falls back to custom", () => {
    expect(matchPresetKey(null, START)).toBe("none");
    expect(matchPresetKey(presetDaily(), START)).toBe("daily");
    expect(matchPresetKey(presetWeeklyOnStart(START), START)).toBe("weekly");
    expect(matchPresetKey({ freq: "DAILY", interval: 3 }, START)).toBe("custom");
  });

  it("describes a custom rule with interval, days and an end date", () => {
    const rule: RecurrenceRule = { freq: "WEEKLY", interval: 2, byDay: ["MO", "WE", "FR"], until: "2026-12-25" };
    expect(describeRule(rule, START)).toBe("Every 2 weeks on Mon, Wed, Fri, until Dec 25, 2026");
  });

  it("round-trips through JSON serialization", () => {
    const rule = presetMonthlyOnDay();
    const json = serializeRule(rule);
    expect(json).toBeTypeOf("string");
    expect(parseRule(json)).toEqual(rule);
    expect(serializeRule(null)).toBeNull();
    expect(parseRule(null)).toBeNull();
    expect(parseRule("not json")).toBeNull();
    expect(parseRule('{"freq":"BOGUS","interval":1}')).toBeNull();
  });
});

describe("expandOccurrences — DAILY", () => {
  it("generates every day within range, respecting interval", () => {
    const rule: RecurrenceRule = { freq: "DAILY", interval: 2 };
    const rangeStart = new Date("2026-08-18T00:00:00+05:30");
    const rangeEnd = new Date("2026-08-24T23:59:59+05:30");
    const occs = expandOccurrences(START, END, rule, rangeStart, rangeEnd);
    expect(occDates(occs)).toEqual(["2026-08-18", "2026-08-20", "2026-08-22", "2026-08-24"]);
  });

  it("stops at `until`", () => {
    const rule: RecurrenceRule = { freq: "DAILY", interval: 1, until: "2026-08-20" };
    const rangeStart = new Date("2026-08-18T00:00:00+05:30");
    const rangeEnd = new Date("2026-08-31T23:59:59+05:30");
    const occs = expandOccurrences(START, END, rule, rangeStart, rangeEnd);
    expect(occDates(occs)).toEqual(["2026-08-18", "2026-08-19", "2026-08-20"]);
  });
});

describe("expandOccurrences — WEEKLY", () => {
  it("every weekday (Mon-Fri) skips weekends", () => {
    const rule = presetEveryWeekday();
    const rangeStart = new Date("2026-08-18T00:00:00+05:30"); // Tue
    const rangeEnd = new Date("2026-08-24T23:59:59+05:30"); // next Mon
    const occs = expandOccurrences(START, END, rule, rangeStart, rangeEnd);
    // Tue 18, Wed 19, Thu 20, Fri 21, (Sat/Sun skipped), Mon 24
    expect(occDates(occs)).toEqual(["2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-24"]);
  });

  it("every N weeks only fires on matching week blocks", () => {
    const rule: RecurrenceRule = { freq: "WEEKLY", interval: 2, byDay: ["TU"] };
    const rangeStart = new Date("2026-08-18T00:00:00+05:30");
    const rangeEnd = new Date("2026-09-15T23:59:59+05:30");
    const occs = expandOccurrences(START, END, rule, rangeStart, rangeEnd);
    // Every-other Tuesday starting 18 Aug: 18 Aug, 1 Sep, 15 Sep (25 Aug and 8 Sep skipped)
    expect(occDates(occs)).toEqual(["2026-08-18", "2026-09-01", "2026-09-15"]);
  });

  it("does not generate occurrences before the series start", () => {
    const rule = presetWeeklyOnStart(START);
    const rangeStart = new Date("2026-08-01T00:00:00+05:30");
    const rangeEnd = new Date("2026-08-31T23:59:59+05:30");
    const occs = expandOccurrences(START, END, rule, rangeStart, rangeEnd);
    expect(occDates(occs)).toEqual(["2026-08-18", "2026-08-25"]);
  });
});

describe("expandOccurrences — MONTHLY", () => {
  it("on the same date each month", () => {
    const rule = presetMonthlyOnDate();
    const rangeStart = new Date("2026-08-01T00:00:00+05:30");
    const rangeEnd = new Date("2026-11-30T23:59:59+05:30");
    const occs = expandOccurrences(START, END, rule, rangeStart, rangeEnd);
    expect(occDates(occs)).toEqual(["2026-08-18", "2026-09-18", "2026-10-18", "2026-11-18"]);
  });

  it("on the same nth weekday each month (third Tuesday)", () => {
    const rule = presetMonthlyOnDay();
    const rangeStart = new Date("2026-08-01T00:00:00+05:30");
    const rangeEnd = new Date("2026-11-30T23:59:59+05:30");
    const occs = expandOccurrences(START, END, rule, rangeStart, rangeEnd);
    // Third Tuesday of Aug/Sep/Oct/Nov 2026
    expect(occDates(occs)).toEqual(["2026-08-18", "2026-09-15", "2026-10-20", "2026-11-17"]);
  });

  it("skips months that don't have the anchor date (31st)", () => {
    const start31 = new Date("2026-01-31T10:00:00+05:30");
    const end31 = new Date("2026-01-31T11:00:00+05:30");
    const rule = presetMonthlyOnDate();
    const rangeStart = new Date("2026-01-01T00:00:00+05:30");
    const rangeEnd = new Date("2026-04-30T23:59:59+05:30");
    const occs = expandOccurrences(start31, end31, rule, rangeStart, rangeEnd);
    // Feb (28 days) and Apr (30 days) have no 31st
    expect(occDates(occs)).toEqual(["2026-01-31", "2026-03-31"]);
  });
});

describe("expandOccurrences — YEARLY", () => {
  it("on the same month/day each year", () => {
    const rule = presetYearly();
    const rangeStart = new Date("2026-01-01T00:00:00+05:30");
    const rangeEnd = new Date("2029-12-31T23:59:59+05:30");
    const occs = expandOccurrences(START, END, rule, rangeStart, rangeEnd);
    expect(occDates(occs)).toEqual(["2026-08-18", "2027-08-18", "2028-08-18", "2029-08-18"]);
  });

  it("clamps Feb 29 to Feb 28 on non-leap years", () => {
    const leapStart = new Date("2028-02-29T09:00:00+05:30"); // 2028 is a leap year
    const leapEnd = new Date("2028-02-29T10:00:00+05:30");
    const rule = presetYearly();
    const rangeStart = new Date("2028-01-01T00:00:00+05:30");
    const rangeEnd = new Date("2031-12-31T23:59:59+05:30");
    const occs = expandOccurrences(leapStart, leapEnd, rule, rangeStart, rangeEnd);
    expect(occDates(occs)).toEqual(["2028-02-29", "2029-02-28", "2030-02-28", "2031-02-28"]);
  });
});

describe("expandOccurrences — range/duration behaviour", () => {
  it("preserves the event's duration on every occurrence", () => {
    const rule = presetDaily();
    const rangeStart = new Date("2026-08-18T00:00:00+05:30");
    const rangeEnd = new Date("2026-08-20T23:59:59+05:30");
    const occs = expandOccurrences(START, END, rule, rangeStart, rangeEnd);
    occs.forEach((o) => {
      expect(o.end.getTime() - o.start.getTime()).toBe(END.getTime() - START.getTime());
    });
  });

  it("returns nothing when the range is entirely before the series starts", () => {
    const rule = presetDaily();
    const rangeStart = new Date("2026-08-01T00:00:00+05:30");
    const rangeEnd = new Date("2026-08-10T23:59:59+05:30");
    const occs = expandOccurrences(START, END, rule, rangeStart, rangeEnd);
    expect(occs).toEqual([]);
  });

  it("returns nothing once `until` has passed, even far into a wide range", () => {
    const rule: RecurrenceRule = { freq: "DAILY", interval: 1, until: "2026-08-19" };
    const rangeStart = new Date("2026-09-01T00:00:00+05:30");
    const rangeEnd = new Date("2026-09-30T23:59:59+05:30");
    const occs = expandOccurrences(START, END, rule, rangeStart, rangeEnd);
    expect(occs).toEqual([]);
  });
});
