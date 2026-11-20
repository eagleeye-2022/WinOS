import { describe, expect, it } from "vitest";
import { isWeekendKey, normalizeSaturdaysOff, resolveDay } from "@/features/attendance/utils";
import { countLeaveDays } from "@/features/leave/leave-rules";
import {
  DEFAULT_WORK_WEEK,
  decodeSaturdaysOff,
  describeSaturdaysOff,
  encodeSaturdaysOff,
  WORK_WEEK_PRESETS,
} from "@/features/users/work-week";
import { parseProfileFieldValue } from "@/features/users/profile-fields";

// November 2026: Saturdays are the 7th (1st), 14th (2nd), 21st (3rd), 28th (4th); Sundays 1, 8, 15…
// August 2026 has five Saturdays: 1, 8, 15, 22, 29.

describe("isWeekendKey with a work week", () => {
  it("keeps the old behaviour by default (every Saturday and Sunday off)", () => {
    expect(isWeekendKey("2026-11-07")).toBe(true);
    expect(isWeekendKey("2026-11-08")).toBe(true);
    expect(isWeekendKey("2026-11-09")).toBe(false);
  });

  it("only the chosen Saturdays are off (1st & 3rd)", () => {
    const off = [1, 3];
    expect(isWeekendKey("2026-11-07", off)).toBe(true); // 1st
    expect(isWeekendKey("2026-11-14", off)).toBe(false); // 2nd — working
    expect(isWeekendKey("2026-11-21", off)).toBe(true); // 3rd
    expect(isWeekendKey("2026-11-28", off)).toBe(false); // 4th — working
  });

  it("the 5th Saturday is working unless picked", () => {
    expect(isWeekendKey("2026-08-29", [3, 4])).toBe(false);
    expect(isWeekendKey("2026-08-29", [5])).toBe(true);
  });

  it("Sundays are always off, even with no Saturday off", () => {
    expect(isWeekendKey("2026-11-08", [])).toBe(true);
    expect(isWeekendKey("2026-11-07", [])).toBe(false);
  });
});

describe("work-week form values", () => {
  it("round-trips, sorted and de-duplicated", () => {
    expect(encodeSaturdaysOff([3, 1, 3])).toBe("1,3");
    expect(encodeSaturdaysOff([])).toBe("none");
    expect(decodeSaturdaysOff("3, 1")).toEqual([1, 3]);
    expect(decodeSaturdaysOff("none")).toEqual([]);
  });

  it("rejects junk", () => {
    expect(decodeSaturdaysOff("6")).toBeNull();
    expect(decodeSaturdaysOff("1;3")).toBeNull();
    expect(decodeSaturdaysOff("")).toBeNull();
  });

  it("falls back to every Saturday off for a missing value", () => {
    expect(normalizeSaturdaysOff(null)).toEqual([1, 2, 3, 4, 5]);
  });

  it("reads well on the profile", () => {
    expect(describeSaturdaysOff([1, 2, 3, 4, 5])).toBe("Saturday & Sunday off");
    expect(describeSaturdaysOff([])).toBe("Only Sunday off (all Saturdays working)");
    expect(describeSaturdaysOff([3, 4])).toBe("Sunday + 3rd & 4th Saturday off");
  });

  it("offers only 1st & 3rd and 3rd & 4th Saturday off; new members start on 1st & 3rd", () => {
    expect(WORK_WEEK_PRESETS.map((p) => encodeSaturdaysOff(p.value))).toEqual(["1,3", "3,4"]);
    expect(encodeSaturdaysOff(DEFAULT_WORK_WEEK)).toBe("1,3");
  });

  it("profile field parsing: empty = default, invalid = error", () => {
    expect(parseProfileFieldValue("saturdaysOff", "")).toEqual({ value: [1, 2, 3, 4, 5] });
    expect(parseProfileFieldValue("saturdaysOff", "2,4")).toEqual({ value: [2, 4] });
    expect(parseProfileFieldValue("saturdaysOff", "none")).toEqual({ value: [] });
    expect("error" in parseProfileFieldValue("saturdaysOff", "9")).toBe(true);
  });
});

describe("leave and attendance follow the person's work week", () => {
  const sandwich = { sandwichPolicy: true, sandwichWeekends: true, sandwichHolidays: true };

  it("a working Saturday counts as a leave day", () => {
    // Fri 13 – Mon 16 Nov: Sat 14 is the 2nd Saturday.
    const base = { fromKey: "2026-11-13", toKey: "2026-11-16", durationType: "FULL_DAY" as const, requestedDays: 0, isHoliday: () => false };
    const everySatOff = countLeaveDays({ ...base, policy: { ...sandwich, sandwichPolicy: false } });
    const firstThirdOff = countLeaveDays({ ...base, policy: { ...sandwich, sandwichPolicy: false }, saturdaysOff: [1, 3] });
    expect("days" in everySatOff && everySatOff.days).toBe(2); // Fri + Mon
    expect("days" in firstThirdOff && firstThirdOff.days).toBe(3); // Fri + Sat + Mon
  });

  it("a working Saturday resolves as a normal (absent) day, an off one as WEEKEND", () => {
    const day = (saturdaysOff: number[]) =>
      resolveDay({
        key: "2026-11-14",
        todayKey: "2026-11-20",
        isHoliday: false,
        attendance: null,
        approvedLeaves: [],
        hasPendingLeave: false,
        regularizationStatus: null,
        saturdaysOff,
      });
    expect(day([1, 2, 3, 4, 5]).status).toBe("WEEKEND");
    expect(day([1, 3]).isWorkingDay).toBe(true);
  });
});
