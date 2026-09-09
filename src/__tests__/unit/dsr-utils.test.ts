import { describe, it, expect } from "vitest";
import { dsrReviewStatus, formatEventTime } from "@/features/dsr/utils";

// ── dsrReviewStatus ───────────────────────────────────────────────────────────

describe("dsrReviewStatus", () => {
  const recentDate = new Date(Date.now() - 12 * 3600 * 1000); // 12 hours ago
  const oldDate = new Date(Date.now() - 4 * 86400 * 1000);    // 4 days ago

  it("returns none for MISSED status", () => {
    const r = dsrReviewStatus({ status: "MISSED", date: recentDate, reviewedAt: null, reviewedBy: null });
    expect(r.kind).toBe("none");
    expect(r.label).toBe("None");
  });

  it("returns reviewed for REVIEWED status", () => {
    const r = dsrReviewStatus({
      status: "REVIEWED",
      date: recentDate,
      reviewedAt: new Date(),
      reviewedBy: { name: "Sarah Jenkins" },
    });
    expect(r.kind).toBe("reviewed");
    expect(r.label).toBe("Reviewed by Sarah");
  });

  it("uses first name only in reviewed label", () => {
    const r = dsrReviewStatus({
      status: "REVIEWED",
      date: recentDate,
      reviewedAt: new Date(),
      reviewedBy: { name: "Alex Rivera" },
    });
    expect(r.label).toBe("Reviewed by Alex");
  });

  it("falls back to 'Manager' when reviewedBy is null", () => {
    const r = dsrReviewStatus({
      status: "REVIEWED",
      date: recentDate,
      reviewedAt: new Date(),
      reviewedBy: null,
    });
    expect(r.label).toBe("Reviewed by Manager");
  });

  it("falls back to 'Manager' when reviewedBy.name is null", () => {
    const r = dsrReviewStatus({
      status: "REVIEWED",
      date: recentDate,
      reviewedAt: new Date(),
      reviewedBy: { name: null },
    });
    expect(r.label).toBe("Reviewed by Manager");
  });

  it("returns pending for recent SUBMITTED entry", () => {
    const r = dsrReviewStatus({ status: "SUBMITTED", date: recentDate, reviewedAt: null, reviewedBy: null });
    expect(r.kind).toBe("pending");
    expect(r.label).toBe("Pending Review");
  });

  it("returns pending for recent PENDING_REVIEW entry", () => {
    const r = dsrReviewStatus({
      status: "PENDING_REVIEW",
      date: recentDate,
      reviewedAt: null,
      reviewedBy: null,
    });
    expect(r.kind).toBe("pending");
    expect(r.label).toBe("Pending Review");
  });

  it("returns missed-deadline for SUBMITTED entry older than 2 days with no review", () => {
    const r = dsrReviewStatus({ status: "SUBMITTED", date: oldDate, reviewedAt: null, reviewedBy: null });
    expect(r.kind).toBe("missed-deadline");
    expect(r.label).toBe("Missed Deadline");
  });

  it("returns missed-deadline for PENDING_REVIEW entry older than 2 days", () => {
    const r = dsrReviewStatus({
      status: "PENDING_REVIEW",
      date: oldDate,
      reviewedAt: null,
      reviewedBy: null,
    });
    expect(r.kind).toBe("missed-deadline");
  });

  it("returns none for DRAFT status", () => {
    const r = dsrReviewStatus({ status: "DRAFT", date: recentDate, reviewedAt: null, reviewedBy: null });
    expect(r.kind).toBe("none");
    expect(r.label).toBe("None");
  });

  it("does NOT return missed-deadline when entry is just under 2 days old", () => {
    // ageDays < 2, so still pending. A few seconds under the boundary rather than
    // exactly 2 days avoids flaking on the ms of execution delay between computing
    // this timestamp and dsrReviewStatus's own internal Date.now() call.
    const justUnderTwoDays = new Date(Date.now() - (2 * 86400 - 5) * 1000);
    const r = dsrReviewStatus({
      status: "SUBMITTED",
      date: justUnderTwoDays,
      reviewedAt: null,
      reviewedBy: null,
    });
    expect(r.kind).toBe("pending");
  });
});

// ── formatEventTime ───────────────────────────────────────────────────────────

describe("formatEventTime", () => {
  it("formats a UTC timestamp as a human-readable string", () => {
    const date = new Date("2026-05-28T17:14:00Z");
    const result = formatEventTime(date);
    // Should include "May", "28", "2026" and a time
    expect(result).toMatch(/May/);
    expect(result).toMatch(/28/);
    expect(result).toMatch(/2026/);
  });

  it("formats different months correctly", () => {
    const date = new Date("2026-01-15T09:00:00Z");
    const result = formatEventTime(date);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2026/);
  });
});
