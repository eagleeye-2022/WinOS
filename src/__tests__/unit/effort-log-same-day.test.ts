import { describe, it, expect } from "vitest";
import {
  calculateMinutesFromTimeRange,
  isSameLocalDay,
  toLocalDateString,
  resolveLogTimePeriod,
  decodeDescriptionWithTimePeriod,
  formatTime12hIST,
  isSameISTDay,
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

  it("derives a missing range in IST whatever the process time zone", () => {
    // 03:44 UTC = 9:14 AM IST
    expect(resolveLogTimePeriod("", 7, new Date(Date.UTC(2026, 10, 13, 3, 44)))).toBe("9:07 AM – 9:14 AM");
  });
});

describe("decodeDescriptionWithTimePeriod", () => {
  it("keeps the time period when the notes span several lines", () => {
    expect(decodeDescriptionWithTimePeriod("[9:06 AM – 9:13 AM] - Brainstorming\nmore notes")).toEqual({
      timePeriod: "9:06 AM – 9:13 AM",
      remarks: "- Brainstorming\nmore notes",
    });
  });
});

describe("formatTime12hIST / isSameISTDay", () => {
  it("formats and compares days in IST", () => {
    expect(formatTime12hIST(new Date(Date.UTC(2026, 10, 13, 11, 22)))).toBe("4:52 PM");
    // 18:00 UTC 13 Nov = 11:30 PM IST; 19:00 UTC = 12:30 AM IST on 14 Nov
    expect(isSameISTDay(new Date(Date.UTC(2026, 10, 13, 17, 0)), new Date(Date.UTC(2026, 10, 13, 18, 0)))).toBe(true);
    expect(isSameISTDay(new Date(Date.UTC(2026, 10, 13, 18, 0)), new Date(Date.UTC(2026, 10, 13, 19, 0)))).toBe(false);
  });
});
