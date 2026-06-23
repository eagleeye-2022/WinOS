import { describe, it, expect } from "vitest";
import { daysOpen, filterBlockers } from "@/features/blockers/utils";
import type { BlockerItem } from "@/features/blockers/queries";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const user = { id: "u1", name: "Alice", email: "alice@test.com" };

function blocker(overrides: Partial<BlockerItem> & { id: string }): BlockerItem {
  return {
    id: overrides.id,
    text: overrides.text ?? "Default blocker text",
    priority: overrides.priority ?? "MEDIUM",
    resolved: overrides.resolved ?? false,
    date: overrides.date ?? new Date("2026-05-28T00:00:00Z"),
    entryId: overrides.entryId ?? "entry-1",
    raisedBy: overrides.raisedBy ?? user,
    comments: overrides.comments ?? [],
  };
}

const highOpen   = blocker({ id: "1", priority: "HIGH",   resolved: false, text: "OAuth keys missing" });
const medResolved = blocker({ id: "2", priority: "MEDIUM", resolved: true,  text: "Checkout flow mockup pending" });
const lowOpen    = blocker({ id: "3", priority: "LOW",    resolved: false, text: "Environment refresh delayed" });
const highOpen2  = blocker({ id: "4", priority: "HIGH",   resolved: false, text: "API contract undocumented" });

const all = [highOpen, medResolved, lowOpen, highOpen2];

// ── daysOpen ──────────────────────────────────────────────────────────────────

describe("daysOpen", () => {
  it("returns 0 for today", () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    expect(daysOpen(today)).toBe(0);
  });

  it("returns 1 for yesterday", () => {
    const yesterday = new Date(Date.now() - 86400000);
    expect(daysOpen(yesterday)).toBe(1);
  });

  it("returns 3 for three days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
    expect(daysOpen(threeDaysAgo)).toBe(3);
  });

  it("never returns a negative value for future dates", () => {
    const tomorrow = new Date(Date.now() + 86400000);
    expect(daysOpen(tomorrow)).toBe(0);
  });
});

// ── filterBlockers — status ───────────────────────────────────────────────────

describe("filterBlockers — status filter", () => {
  it("all: returns everything", () => {
    expect(filterBlockers(all, "all", "all", "")).toHaveLength(4);
  });

  it("in_progress: returns only unresolved blockers", () => {
    const result = filterBlockers(all, "in_progress", "all", "");
    expect(result.every((b) => !b.resolved)).toBe(true);
    expect(result).toHaveLength(3);
  });

  it("resolved: returns only resolved blockers", () => {
    const result = filterBlockers(all, "resolved", "all", "");
    expect(result.every((b) => b.resolved)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("in_progress on empty list returns empty", () => {
    expect(filterBlockers([], "in_progress", "all", "")).toEqual([]);
  });
});

// ── filterBlockers — priority ─────────────────────────────────────────────────

describe("filterBlockers — priority filter", () => {
  it("HIGH: returns only HIGH priority blockers", () => {
    const result = filterBlockers(all, "all", "HIGH", "");
    expect(result.every((b) => b.priority === "HIGH")).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("MEDIUM: returns only MEDIUM priority blockers", () => {
    const result = filterBlockers(all, "all", "MEDIUM", "");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("LOW: returns only LOW priority blockers", () => {
    const result = filterBlockers(all, "all", "LOW", "");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  it("all priority: returns everything", () => {
    expect(filterBlockers(all, "all", "all", "")).toHaveLength(4);
  });
});

// ── filterBlockers — search ───────────────────────────────────────────────────

describe("filterBlockers — search", () => {
  it("matches substring of text case-insensitively", () => {
    const result = filterBlockers(all, "all", "all", "oauth");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("empty search returns all items", () => {
    expect(filterBlockers(all, "all", "all", "")).toHaveLength(4);
  });

  it("no match returns empty array", () => {
    expect(filterBlockers(all, "all", "all", "xyzzy-not-found")).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(filterBlockers(all, "all", "all", "API CONTRACT")).toHaveLength(1);
  });
});

// ── filterBlockers — combined ─────────────────────────────────────────────────

describe("filterBlockers — combined filters", () => {
  it("status=in_progress + priority=HIGH returns unresolved HIGH items", () => {
    const result = filterBlockers(all, "in_progress", "HIGH", "");
    expect(result).toHaveLength(2);
    expect(result.every((b) => !b.resolved && b.priority === "HIGH")).toBe(true);
  });

  it("status=resolved + search=checkout returns the single resolved match", () => {
    const result = filterBlockers(all, "resolved", "all", "checkout");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("no match across all filters returns empty", () => {
    expect(filterBlockers(all, "in_progress", "LOW", "oauth")).toEqual([]);
  });
});
