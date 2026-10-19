import { describe, it, expect } from "vitest";
import {
  canManageAttendance,
  dateFromKey,
  istDateKey,
  istTimeString,
  leaveFractionOnDay,
  netHours,
  normalizeTime,
  parseTime12h,
  resolveDay,
  rollupMonth,
  shiftDiff,
  weekKeysFor,
  workedMinutesBetween,
  type LeaveSpan,
  type ResolveDayInput,
} from "@/features/attendance/utils";

const d = (key: string) => dateFromKey(key)!;

function leave(over: Partial<LeaveSpan> = {}): LeaveSpan {
  return {
    fromDate: d("2026-10-14"),
    toDate: d("2026-10-14"),
    durationType: "FULL_DAY",
    durationDays: 1,
    status: "APPROVED",
    isLossOfPay: false,
    lopDaysCount: 0,
    ...over,
  };
}

// 2026-10-14 is a Wednesday; "today" is the 16th (Friday).
function day(over: Partial<ResolveDayInput> = {}): ResolveDayInput {
  return {
    key: "2026-10-14",
    todayKey: "2026-10-16",
    isHoliday: false,
    attendance: null,
    approvedLeaves: [],
    hasPendingLeave: false,
    regularizationStatus: null,
    ...over,
  };
}

const punched = (checkInTime: string | null, checkOutTime: string | null, isLive = false) => ({
  status: isLive ? "WORKING_NOW" : "PRESENT",
  checkInTime,
  checkOutTime,
  isLive,
});

describe("IST date/time", () => {
  it("rolls the date over at IST midnight, not UTC midnight", () => {
    // 20:00 UTC on the 15th is 01:30 IST on the 16th.
    expect(istDateKey(new Date("2026-10-15T20:00:00Z"))).toBe("2026-10-16");
    expect(istDateKey(new Date("2026-10-15T18:00:00Z"))).toBe("2026-10-15");
  });

  it("formats wall-clock time in IST", () => {
    expect(istTimeString(new Date("2026-10-16T04:00:00Z"))).toBe("09:30 AM");
    expect(istTimeString(new Date("2026-10-16T13:00:00Z"))).toBe("06:30 PM");
  });

  it("rejects malformed or impossible date keys", () => {
    expect(dateFromKey("2026-02-30")).toBeNull();
    expect(dateFromKey("16/10/2026")).toBeNull();
  });

  it("builds Monday-first weeks", () => {
    expect(weekKeysFor("2026-10-16")).toEqual([
      "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18",
    ]);
    // Sunday belongs to the week that started the previous Monday.
    expect(weekKeysFor("2026-10-18")[0]).toBe("2026-10-12");
  });
});

describe("time parsing", () => {
  it("accepts 12h and 24h input", () => {
    expect(parseTime12h("9:30 am")).toBe(570);
    expect(parseTime12h("12:15 AM")).toBe(15);
    expect(parseTime12h("12:15 PM")).toBe(735);
    expect(parseTime12h("18:30")).toBe(1110);
    expect(parseTime12h("25:00")).toBeNull();
    expect(parseTime12h("13:00 PM")).toBeNull();
    expect(normalizeTime("6:05 pm")).toBe("06:05 PM");
  });

  it("only counts worked time when check-out is after check-in", () => {
    expect(workedMinutesBetween("09:30 AM", "06:45 PM")).toBe(555);
    expect(workedMinutesBetween("06:45 PM", "09:30 AM")).toBeNull();
    expect(workedMinutesBetween("09:30 AM", null)).toBeNull();
  });

  it("labels early/late against the shift", () => {
    expect(shiftDiff("09:26 AM", "09:30 AM")).toEqual({ type: "early", label: "04 min Early" });
    expect(shiftDiff("10:45 AM", "09:30 AM")).toEqual({ type: "late", label: "1h 15m Late" });
    expect(shiftDiff("09:30 AM", "09:30 AM")?.type).toBe("on-time");
    expect(netHours(9 * 60 + 15)).toEqual({ type: "positive", label: "+00:15" });
    expect(netHours(8 * 60)).toEqual({ type: "negative", label: "-01:00" });
  });
});

describe("leaveFractionOnDay", () => {
  it("uses the day fraction of single-day partial leave", () => {
    expect(leaveFractionOnDay(leave({ durationType: "HALF_DAY", durationDays: 0.5 }), "2026-10-14")).toBe(0.5);
    expect(leaveFractionOnDay(leave(), "2026-10-15")).toBe(0);
  });

  it("counts every covered day of a multi-day full leave", () => {
    const l = leave({ toDate: d("2026-10-16"), durationDays: 3 });
    expect(leaveFractionOnDay(l, "2026-10-15")).toBe(1);
  });
});

describe("resolveDay", () => {
  it("weekends and holidays are not working days, even with a punch", () => {
    const sat = resolveDay(day({ key: "2026-10-17", todayKey: "2026-10-19", attendance: punched("10:00 AM", "02:00 PM") }));
    expect(sat).toMatchObject({ status: "WEEKEND", isWorkingDay: false, absent: 0 });
    expect(resolveDay(day({ isHoliday: true })).status).toBe("HOLIDAY");
  });

  it("a live session on today's day off can still be checked out", () => {
    const r = resolveDay(day({ key: "2026-10-17", todayKey: "2026-10-17", attendance: punched("10:00 AM", null, true) }));
    expect(r).toMatchObject({ status: "WORKING_NOW", isWorkingDay: false, present: 0 });
  });

  it("an unexplained past working day needs action and counts as absent", () => {
    const r = resolveDay(day());
    expect(r).toMatchObject({ status: "ACTION_REQUIRED", absent: 1, action: { type: "MISSING_BOTH" } });
  });

  it("approved full-day leave covers the day — no regularization asked", () => {
    const r = resolveDay(day({ approvedLeaves: [leave()] }));
    expect(r).toMatchObject({ status: "ON_LEAVE", paidLeave: 1, absent: 0 });
    expect(r.action).toBeUndefined();
  });

  it("unpaid (LOP) leave is split out from paid leave", () => {
    const r = resolveDay(day({ approvedLeaves: [leave({ isLossOfPay: true, lopDaysCount: 1 })] }));
    expect(r).toMatchObject({ paidLeave: 0, lopLeave: 1 });
  });

  it("pending leave suppresses the action without counting leave yet", () => {
    const r = resolveDay(day({ hasPendingLeave: true }));
    expect(r).toMatchObject({ status: "ON_LEAVE", absent: 0, paidLeave: 0 });
    expect(r.action).toBeUndefined();
  });

  it("half-day leave plus a full punch is a half day, fully accounted", () => {
    const r = resolveDay(
      day({
        approvedLeaves: [leave({ durationType: "HALF_DAY", durationDays: 0.5 })],
        attendance: punched("01:30 PM", "06:30 PM"),
      })
    );
    expect(r).toMatchObject({ status: "HALF_DAY_LEAVE", present: 0.5, paidLeave: 0.5, absent: 0 });
  });

  it("half-day leave with no punch on a past day still asks for the other half", () => {
    const r = resolveDay(day({ approvedLeaves: [leave({ durationType: "HALF_DAY", durationDays: 0.5 })] }));
    expect(r).toMatchObject({ status: "HALF_DAY_LEAVE", absent: 0.5, action: { type: "MISSING_BOTH" } });
  });

  it("a past day without check-out needs regularizing", () => {
    const r = resolveDay(day({ attendance: punched("09:30 AM", null, true) }));
    expect(r).toMatchObject({ status: "ACTION_REQUIRED", action: { type: "MISSING_CHECKOUT" } });
  });

  it("only today can be 'working now' — a stale live flag doesn't stick", () => {
    expect(resolveDay(day({ key: "2026-10-16", attendance: punched("09:30 AM", null, true) })).status).toBe(
      "WORKING_NOW"
    );
  });

  it("a pending regularization removes the action but keeps the day flagged", () => {
    const r = resolveDay(day({ regularizationStatus: "PENDING" }));
    expect(r.status).toBe("ACTION_REQUIRED");
    expect(r.action).toBeUndefined();
    expect(r.note).toMatch(/pending/i);
  });

  it("a rejected regularization asks again and says why", () => {
    const r = resolveDay(day({ regularizationStatus: "REJECTED" }));
    expect(r.action?.issue).toMatch(/rejected/i);
  });

  it("today and future days without a punch are not absences", () => {
    expect(resolveDay(day({ key: "2026-10-16" }))).toMatchObject({ status: "ABSENT", absent: 0 });
    expect(resolveDay(day({ key: "2026-10-20" }))).toMatchObject({ status: "ABSENT", absent: 0 });
  });
});

describe("rollupMonth", () => {
  it("adds up present, half days, paid offs, LOP and absences", () => {
    const days = [
      resolveDay(day({ key: "2026-10-12", attendance: punched("09:30 AM", "06:30 PM") })),
      resolveDay(day({ key: "2026-10-13", approvedLeaves: [leave({ fromDate: d("2026-10-13"), toDate: d("2026-10-13") })] })),
      resolveDay(
        day({
          key: "2026-10-14",
          approvedLeaves: [leave({ durationType: "HALF_DAY", durationDays: 0.5 })],
          attendance: punched("01:30 PM", "06:30 PM"),
        })
      ),
      resolveDay(day({ key: "2026-10-15" })),
      resolveDay(day({ key: "2026-10-17", todayKey: "2026-10-19" })),
    ];
    expect(rollupMonth(days)).toEqual({
      companyWorkingDays: 4,
      presentDays: 1,
      halfDays: 1,
      paidOffs: 1.5,
      lossOfPay: 0,
      absentDays: 1,
      paidDays: 3,
    });
  });
});

describe("canManageAttendance", () => {
  it("allows managers and admins only", () => {
    expect(canManageAttendance({ role: "MANAGER" })).toBe(true);
    expect(canManageAttendance({ role: "TEAM_MEMBER", profileRole: "ADMIN" })).toBe(true);
    expect(canManageAttendance({ role: "TEAM_MEMBER", profileRole: "EMPLOYEE" })).toBe(false);
    expect(canManageAttendance(null)).toBe(false);
  });
});
