import { describe, it, expect } from "vitest";
import { resolveDay, type ResolveDayInput } from "@/features/attendance/utils";
import {
  formatDmy,
  istGreeting,
  presenceLabel,
  previousMonthRange,
  scheduleDayLabel,
  sundayWeekKeys,
  type DayLabelInput,
} from "@/features/pulse-home/utils";

// 2026-10-29 is a Thursday.
const TODAY = "2026-10-29";

function input(
  key: string,
  over: Partial<Omit<DayLabelInput, "resolved">> = {},
  dayOver: Partial<ResolveDayInput> = {}
): DayLabelInput {
  const attendance =
    over.checkInTime !== undefined
      ? { status: "PRESENT", checkInTime: over.checkInTime, checkOutTime: over.checkOutTime ?? null, isLive: false, ...dayOver.attendance }
      : dayOver.attendance ?? null;
  return {
    key,
    todayKey: TODAY,
    checkInTime: null,
    checkOutTime: null,
    workMode: null,
    holidayName: null,
    leaveStatus: null,
    ...over,
    resolved: resolveDay({
      key,
      todayKey: TODAY,
      isHoliday: false,
      approvedLeaves: [],
      hasPendingLeave: false,
      regularizationStatus: null,
      ...dayOver,
      attendance,
    }),
  };
}

describe("sundayWeekKeys", () => {
  it("returns Sunday → Saturday around the date", () => {
    expect(sundayWeekKeys(TODAY)).toEqual([
      "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31",
    ]);
  });
  it("starts on the same day when given a Sunday", () => {
    expect(sundayWeekKeys("2026-10-25")[0]).toBe("2026-10-25");
  });
});

describe("previousMonthRange", () => {
  it("covers the whole previous month", () => {
    expect(previousMonthRange(TODAY)).toEqual({ startKey: "2026-09-01", endKey: "2026-09-30" });
  });
  it("wraps across the year boundary", () => {
    expect(previousMonthRange("2026-01-05")).toEqual({ startKey: "2025-12-01", endKey: "2025-12-31" });
  });
});

describe("scheduleDayLabel", () => {
  it("marks weekends", () => {
    expect(scheduleDayLabel(input("2026-10-25"))).toEqual({ label: "Weekend", tone: "warning" });
  });
  it("marks a past working day with no attendance as absent", () => {
    expect(scheduleDayLabel(input("2026-10-27"))).toEqual({ label: "Absent", tone: "danger" });
  });
  it("shows the work mode for a checked-in day", () => {
    expect(
      scheduleDayLabel(input("2026-10-28", { checkInTime: "10:00 AM", checkOutTime: "07:43 PM", workMode: "REMOTE" }))
    ).toEqual({ label: "Remote In", tone: "success" });
  });
  it("flags a past day with a missing check-out", () => {
    expect(scheduleDayLabel(input("2026-10-28", { checkInTime: "10:00 AM" }))).toEqual({
      label: "Missing check-out",
      tone: "danger",
    });
  });
  it("uses the holiday name", () => {
    expect(scheduleDayLabel(input("2026-10-27", { holidayName: "Diwali" }, { isHoliday: true }))).toEqual({
      label: "Diwali",
      tone: "warning",
    });
  });
  it("says yet to check-in for today and nothing for future days", () => {
    expect(scheduleDayLabel(input(TODAY))?.label).toBe("Yet to check-in");
    expect(scheduleDayLabel(input("2026-10-30"))).toBeNull();
  });
});

describe("presenceLabel", () => {
  it("is green while working", () => {
    const d = input(TODAY, { checkInTime: "10:00 AM", workMode: "OFFICE" }, {
      attendance: { status: "WORKING_NOW", checkInTime: "10:00 AM", checkOutTime: null, isLive: true },
    });
    expect(presenceLabel(d)).toEqual({ label: "Office In", tone: "success" });
  });
  it("shows checked out after check-out", () => {
    expect(presenceLabel(input(TODAY, { checkInTime: "10:00 AM", checkOutTime: "06:30 PM" })).label).toBe("Checked out");
  });
  it("is off on a weekend", () => {
    expect(presenceLabel({ ...input("2026-10-31"), todayKey: "2026-10-31" }).label).toBe("Off today");
  });
  it("defaults to yet to check-in", () => {
    expect(presenceLabel(input(TODAY))).toEqual({ label: "Yet to check-in", tone: "danger" });
  });
});

describe("formatting", () => {
  it("formats dd/mm/yyyy", () => {
    expect(formatDmy("2026-11-06")).toBe("06/11/2026");
  });
  it("greets by IST hour", () => {
    expect(istGreeting(new Date("2026-10-29T03:00:00Z"))).toBe("Good Morning"); // 08:30 IST
    expect(istGreeting(new Date("2026-10-29T08:00:00Z"))).toBe("Good Afternoon"); // 13:30 IST
    expect(istGreeting(new Date("2026-10-29T13:00:00Z"))).toBe("Good Evening"); // 18:30 IST
  });
});
