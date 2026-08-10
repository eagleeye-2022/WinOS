import { describe, it, expect } from "vitest";
import {
  toUtcDate,
  isoToUtcDate,
  toIsoDateStr,
  weekOfMonth,
  getWeekRange,
  reviewStatus,
  relativeDayLabel,
  formatShortDate,
  formatFullDate,
  sortTeamMembers,
  sortTeamGroups,
} from "@/features/dsm/utils";

// ── toUtcDate ─────────────────────────────────────────────────────────────────

describe("toUtcDate", () => {
  it("normalizes to UTC midnight for today", () => {
    const result = toUtcDate(new Date("2026-05-28T15:30:00Z"));
    expect(result.toISOString()).toBe("2026-05-28T00:00:00.000Z");
  });

  it("strips time component to UTC midnight (using midday input safe across timezones)", () => {
    // Use 10:00 UTC — same local date in any UTC-9 to UTC+13 timezone
    const result = toUtcDate(new Date("2026-01-15T10:00:00Z"));
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
    expect(result.getUTCMilliseconds()).toBe(0);
  });

  it("defaults to today when no argument given", () => {
    const result = toUtcDate();
    const today = new Date();
    expect(result.toISOString().slice(0, 10)).toBe(
      new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
        .toISOString()
        .slice(0, 10)
    );
  });

  it("handles first day of month", () => {
    expect(toUtcDate(new Date("2026-03-01T08:00:00Z")).toISOString()).toBe(
      "2026-03-01T00:00:00.000Z"
    );
  });
});

// ── isoToUtcDate ──────────────────────────────────────────────────────────────

describe("isoToUtcDate", () => {
  it("parses YYYY-MM-DD to UTC midnight", () => {
    expect(isoToUtcDate("2026-05-28").toISOString()).toBe("2026-05-28T00:00:00.000Z");
  });

  it("parses a date in January", () => {
    expect(isoToUtcDate("2026-01-01").toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

// ── toIsoDateStr ──────────────────────────────────────────────────────────────

describe("toIsoDateStr", () => {
  it("formats UTC midnight as YYYY-MM-DD", () => {
    expect(toIsoDateStr(new Date("2026-05-28T00:00:00.000Z"))).toBe("2026-05-28");
  });

  it("round-trips with isoToUtcDate", () => {
    const iso = "2026-12-31";
    expect(toIsoDateStr(isoToUtcDate(iso))).toBe(iso);
  });
});

// ── weekOfMonth ───────────────────────────────────────────────────────────────

describe("weekOfMonth", () => {
  it("May 1 is week 1", () => {
    expect(weekOfMonth(new Date("2026-05-01T00:00:00Z"))).toBe(1);
  });

  it("May 7 is week 2 (May 2026 starts on a Friday, so Mon May 4 opens week 2)", () => {
    expect(weekOfMonth(new Date("2026-05-07T00:00:00Z"))).toBe(2);
  });

  it("May 8 is week 2", () => {
    expect(weekOfMonth(new Date("2026-05-08T00:00:00Z"))).toBe(2);
  });

  it("May 28 is week 5", () => {
    expect(weekOfMonth(new Date("2026-05-28T00:00:00Z"))).toBe(5);
  });

  it("June 1 resets to week 1", () => {
    expect(weekOfMonth(new Date("2026-06-01T00:00:00Z"))).toBe(1);
  });
});

// ── getWeekRange ──────────────────────────────────────────────────────────────

describe("getWeekRange", () => {
  const thursday = new Date("2026-05-28T00:00:00Z"); // Thursday

  it("returns Monday as start of current week (offset 0)", () => {
    const { start } = getWeekRange(0, thursday);
    expect(start.toISOString().slice(0, 10)).toBe("2026-05-25"); // Monday
  });

  it("returns Sunday as end of current week", () => {
    const { end } = getWeekRange(0, thursday);
    expect(end.toISOString().slice(0, 10)).toBe("2026-05-31"); // Sunday
  });

  it("returns previous week with offset -1", () => {
    const { start, end } = getWeekRange(-1, thursday);
    expect(start.toISOString().slice(0, 10)).toBe("2026-05-18");
    expect(end.toISOString().slice(0, 10)).toBe("2026-05-24");
  });

  it("returns next week with offset +1", () => {
    const { start, end } = getWeekRange(1, thursday);
    expect(start.toISOString().slice(0, 10)).toBe("2026-06-01");
    expect(end.toISOString().slice(0, 10)).toBe("2026-06-07");
  });

  it("handles Monday as the from-date", () => {
    const monday = new Date("2026-05-25T00:00:00Z");
    const { start } = getWeekRange(0, monday);
    expect(start.toISOString().slice(0, 10)).toBe("2026-05-25");
  });

  it("handles Sunday as the from-date", () => {
    const sunday = new Date("2026-05-31T00:00:00Z");
    const { start } = getWeekRange(0, sunday);
    expect(start.toISOString().slice(0, 10)).toBe("2026-05-25");
  });

  it("end is 23:59:59.999 UTC", () => {
    const { end } = getWeekRange(0, thursday);
    expect(end.getUTCHours()).toBe(23);
    expect(end.getUTCMinutes()).toBe(59);
    expect(end.getUTCSeconds()).toBe(59);
  });
});

// ── reviewStatus ──────────────────────────────────────────────────────────────

describe("reviewStatus", () => {
  const recentDate = new Date(Date.now() - 12 * 3600 * 1000); // 12 hours ago
  const oldDate = new Date(Date.now() - 4 * 86400 * 1000);   // 4 days ago

  it("returns none for MISSED status", () => {
    const r = reviewStatus({ status: "MISSED", date: recentDate, reviewedAt: null, reviewedBy: null });
    expect(r.kind).toBe("none");
    expect(r.label).toBe("None");
  });

  it("returns reviewed for REVIEWED status", () => {
    const r = reviewStatus({
      status: "REVIEWED",
      date: recentDate,
      reviewedAt: new Date(),
      reviewedBy: { name: "Sarah Jenkins" },
    });
    expect(r.kind).toBe("reviewed");
    expect(r.label).toBe("Reviewed by Sarah");
  });

  it("uses first name only in reviewed label", () => {
    const r = reviewStatus({
      status: "REVIEWED",
      date: recentDate,
      reviewedAt: new Date(),
      reviewedBy: { name: "Marcus Wright" },
    });
    expect(r.label).toBe("Reviewed by Marcus");
  });

  it("falls back to 'Manager' when reviewedBy.name is null", () => {
    const r = reviewStatus({
      status: "REVIEWED",
      date: recentDate,
      reviewedAt: new Date(),
      reviewedBy: { name: null },
    });
    expect(r.label).toBe("Reviewed by Manager");
  });

  it("returns pending for recent SUBMITTED entry", () => {
    const r = reviewStatus({ status: "SUBMITTED", date: recentDate, reviewedAt: null, reviewedBy: null });
    expect(r.kind).toBe("pending");
    expect(r.label).toBe("Pending Review");
  });

  it("returns pending for recent PENDING_REVIEW entry", () => {
    const r = reviewStatus({ status: "PENDING_REVIEW", date: recentDate, reviewedAt: null, reviewedBy: null });
    expect(r.kind).toBe("pending");
  });

  it("returns missed-deadline for old SUBMITTED entry with no review", () => {
    const r = reviewStatus({ status: "SUBMITTED", date: oldDate, reviewedAt: null, reviewedBy: null });
    expect(r.kind).toBe("missed-deadline");
    expect(r.label).toBe("Missed Deadline");
  });

  it("returns none for DRAFT status", () => {
    const r = reviewStatus({ status: "DRAFT", date: recentDate, reviewedAt: null, reviewedBy: null });
    expect(r.kind).toBe("none");
  });
});

// ── relativeDayLabel ──────────────────────────────────────────────────────────

describe("relativeDayLabel", () => {
  const today = new Date("2026-05-28T10:00:00Z");

  it("returns 'Today' for today's date", () => {
    expect(relativeDayLabel(new Date("2026-05-28T00:00:00Z"), today)).toBe("Today");
  });

  it("returns 'Yesterday' for yesterday's date", () => {
    expect(relativeDayLabel(new Date("2026-05-27T00:00:00Z"), today)).toBe("Yesterday");
  });

  it("returns null for two days ago", () => {
    expect(relativeDayLabel(new Date("2026-05-26T00:00:00Z"), today)).toBeNull();
  });

  it("returns null for future dates", () => {
    expect(relativeDayLabel(new Date("2026-05-29T00:00:00Z"), today)).toBeNull();
  });
});

// ── formatShortDate ───────────────────────────────────────────────────────────

describe("formatShortDate", () => {
  it("formats as 'May 28'", () => {
    expect(formatShortDate(new Date("2026-05-28T00:00:00Z"))).toBe("May 28");
  });

  it("formats January 1 correctly", () => {
    expect(formatShortDate(new Date("2026-01-01T00:00:00Z"))).toBe("Jan 1");
  });
});

// ── formatFullDate ────────────────────────────────────────────────────────────

describe("formatFullDate", () => {
  it("formats as 'May 28, 2026'", () => {
    expect(formatFullDate(new Date("2026-05-28T00:00:00Z"))).toBe("May 28, 2026");
  });
});

// ── sortTeamMembers & sortTeamGroups ─────────────────────────────────────────

describe("sortTeamMembers", () => {
  it("sorts Tech team members in explicit sequence: Ujjwal -> Mohit / M.thakre -> Dhruv", () => {
    const members = [
      { name: "Dhruv Sharma" },
      { name: "M.thakre" },
      { name: "Ujjawal Singh" },
    ];
    const sorted = sortTeamMembers(members, "Tech Team");
    expect(sorted.map((m) => m.name)).toEqual([
      "Ujjawal Singh",
      "M.thakre",
      "Dhruv Sharma",
    ]);
  });

  it("sorts remaining Tech members alphabetically after fixed ranks", () => {
    const members = [
      { name: "Zack" },
      { name: "Dhruv" },
      { name: "Alex" },
      { name: "Ishita" },
      { name: "Mohit" },
      { name: "Ujjwal" },
    ];
    const sorted = sortTeamMembers(members, "Engineering");
    expect(sorted.map((m) => m.name)).toEqual([
      "Ujjwal",
      "Mohit",
      "Dhruv",
      "Alex",
      "Ishita",
      "Zack",
    ]);
  });

  it("sorts Creative team members in explicit sequence: Shadab -> Vanshika -> Vaishnavi", () => {
    const members = [
      { name: "Vaishnavi" },
      { name: "Vanshika" },
      { name: "Shadab" },
      { name: "Test Member" },
    ];
    const sorted = sortTeamMembers(members, "Creative Team");
    expect(sorted.map((m) => m.name)).toEqual([
      "Shadab",
      "Vanshika",
      "Vaishnavi",
      "Test Member",
    ]);
  });

  it("sorts Marketing team members in explicit sequence: Rahil -> Muskan -> Unnati -> Priyanka -> Yogesh", () => {
    const members = [
      { name: "Yogesh" },
      { name: "Priyanka" },
      { name: "Muskan" },
      { name: "Rahil" },
      { name: "Unnati" },
    ];
    const sorted = sortTeamMembers(members, "Marketing Team");
    expect(sorted.map((m) => m.name)).toEqual([
      "Rahil",
      "Muskan",
      "Unnati",
      "Priyanka",
      "Yogesh",
    ]);
  });

  it("sorts SMM team members with Rohan first", () => {
    const members = [
      { name: "Test Member" },
      { name: "Rohan Gour" },
    ];
    const sorted = sortTeamMembers(members, "SMM Team");
    expect(sorted.map((m) => m.name)).toEqual([
      "Rohan Gour",
      "Test Member",
    ]);
  });
});

describe("sortTeamGroups", () => {
  it("sorts groups by Department Rank (Marketing -> Creative -> Tech -> Others)", () => {
    const groups = [
      { teamName: "Tech Team", department: "Engineering" },
      { teamName: "Marketing Team", department: "Marketing" },
      { teamName: "Design Team", department: "Creative" },
    ];
    const sorted = sortTeamGroups(groups);
    expect(sorted.map((g) => g.teamName)).toEqual([
      "Marketing Team",
      "Design Team",
      "Tech Team",
    ]);
  });

  it("ranks SMM after Marketing -> Creative -> Tech", () => {
    const groups = [
      { teamName: "SMM Team", department: null },
      { teamName: "Tech Team", department: "Engineering" },
      { teamName: "Marketing Team", department: "Marketing" },
      { teamName: "Design Team", department: "Creative" },
    ];
    const sorted = sortTeamGroups(groups);
    expect(sorted.map((g) => g.teamName)).toEqual([
      "Marketing Team",
      "Design Team",
      "Tech Team",
      "SMM Team",
    ]);
  });
});
