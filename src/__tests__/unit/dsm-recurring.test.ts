import { describe, it, expect } from "vitest";
import {
  matchesDsmRecurrence,
  formatRecurrenceBadge,
  type RecurrenceRule,
} from "@/features/dsm/recurring-utils";
import { isoToUtcDate } from "@/features/dsm/utils";

describe("matchesDsmRecurrence", () => {
  const start = isoToUtcDate("2026-11-02"); // Monday

  it("matches DAILY every day from startDate onwards", () => {
    const rule: RecurrenceRule = { freq: "DAILY", interval: 1 };
    expect(matchesDsmRecurrence(start, rule, isoToUtcDate("2026-11-01"))).toBe(false);
    expect(matchesDsmRecurrence(start, rule, isoToUtcDate("2026-11-02"))).toBe(true);
    expect(matchesDsmRecurrence(start, rule, isoToUtcDate("2026-11-05"))).toBe(true);
  });

  it("respects interval > 1 for DAILY", () => {
    const rule: RecurrenceRule = { freq: "DAILY", interval: 2 };
    expect(matchesDsmRecurrence(start, rule, isoToUtcDate("2026-11-02"))).toBe(true);
    expect(matchesDsmRecurrence(start, rule, isoToUtcDate("2026-11-03"))).toBe(false);
    expect(matchesDsmRecurrence(start, rule, isoToUtcDate("2026-11-04"))).toBe(true);
  });

  it("matches weekdays (Mon-Fri) and skips weekends", () => {
    const rule: RecurrenceRule = {
      freq: "WEEKLY",
      interval: 1,
      byDay: ["MO", "TU", "WE", "TH", "FR"],
    };
    expect(matchesDsmRecurrence(start, rule, isoToUtcDate("2026-11-06"))).toBe(true); // Friday
    expect(matchesDsmRecurrence(start, rule, isoToUtcDate("2026-11-07"))).toBe(false); // Saturday
    expect(matchesDsmRecurrence(start, rule, isoToUtcDate("2026-11-08"))).toBe(false); // Sunday
    expect(matchesDsmRecurrence(start, rule, isoToUtcDate("2026-11-09"))).toBe(true); // Monday
  });

  it("respects endDate and rule.until", () => {
    const rule: RecurrenceRule = { freq: "DAILY", interval: 1, until: "2026-11-04" };
    expect(matchesDsmRecurrence(start, rule, isoToUtcDate("2026-11-04"))).toBe(true);
    expect(matchesDsmRecurrence(start, rule, isoToUtcDate("2026-11-05"))).toBe(false);

    const noUntil: RecurrenceRule = { freq: "DAILY", interval: 1 };
    expect(matchesDsmRecurrence(start, noUntil, isoToUtcDate("2026-11-05"), isoToUtcDate("2026-11-03"))).toBe(false);
  });

  it("formats compact badges", () => {
    expect(formatRecurrenceBadge({ freq: "DAILY", interval: 1 }, start)).toBe("Daily");
    expect(
      formatRecurrenceBadge({ freq: "WEEKLY", interval: 1, byDay: ["MO", "TU", "WE", "TH", "FR"] }, start)
    ).toBe("Weekdays");
    expect(formatRecurrenceBadge({ freq: "WEEKLY", interval: 1, byDay: ["MO"] }, start)).toBe("Weekly");
    expect(formatRecurrenceBadge({ freq: "MONTHLY", interval: 1 }, start)).toBe("Monthly");
  });
});
