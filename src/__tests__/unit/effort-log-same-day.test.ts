import { describe, it, expect } from "vitest";
import {
  calculateMinutesFromTimeRange,
  isSameLocalDay,
  toLocalDateString,
  resolveLogTimePeriod,
  MAX_LOG_MINUTES,
} from "@/features/projects/utils/time-helpers";

// Effort-log rule: a log (timer or manual) can be any length, as long as it starts and ends on
// the same calendar day — no 12-hour cap.

describe("calculateMinutesFromTimeRange (same-day ranges)", () => {
  it("allows long ranges within the day — 12h, 13h and more", () => {
    expect(calculateMinutesFromTimeRange("6:00 AM", "6:00 PM")).toBe(720);
    expect(calculateMinutesFromTimeRange("7:00 AM", "8:00 PM")).toBe(780);
    expect(calculateMinutesFromTimeRange("12:00 AM", "11:59 PM")).toBe(MAX_LOG_MINUTES);
  });

  it("rejects ranges that would run past midnight, or end where they start", () => {
    expect(calculateMinutesFromTimeRange("10:00 PM", "1:00 AM")).toBeNull();
    expect(calculateMinutesFromTimeRange("6:00 PM", "6:00 AM")).toBeNull();
    expect(calculateMinutesFromTimeRange("9:00 AM", "9:00 AM")).toBeNull();
  });

  it("accepts 24-hour input and rejects junk", () => {
    expect(calculateMinutesFromTimeRange("09:30", "18:45")).toBe(555);
    expect(calculateMinutesFromTimeRange("nine", "5:00 PM")).toBeNull();
  });
});

describe("isSameLocalDay / toLocalDateString", () => {
  it("uses the local calendar day, not the UTC one", () => {
    const earlyMorning = new Date(2026, 9, 11, 0, 30); // 12:30 AM local, 11 Oct
    expect(toLocalDateString(earlyMorning)).toBe("2026-10-11");
  });

  it("is true within one day and false across midnight", () => {
    expect(isSameLocalDay(new Date(2026, 9, 10, 6, 0), new Date(2026, 9, 10, 19, 0))).toBe(true);
    expect(isSameLocalDay(new Date(2026, 9, 10, 22, 0), new Date(2026, 9, 11, 1, 0))).toBe(false);
  });
});

describe("resolveLogTimePeriod", () => {
  it("keeps a recorded range whatever the duration (no more hiding logs over 12h)", () => {
    expect(resolveLogTimePeriod("7:00 AM – 8:00 PM", 780)).toBe("7:00 AM – 8:00 PM");
  });

  it("still doesn't invent a range for long logs saved without one", () => {
    expect(resolveLogTimePeriod("", 780, new Date(2026, 9, 10, 20, 0))).toBe("");
  });
});
