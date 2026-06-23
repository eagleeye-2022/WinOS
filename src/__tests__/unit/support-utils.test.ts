import { describe, it, expect } from "vitest";
import { daysOpen, filterSupport } from "@/features/support-needed/utils";
import type { SupportNeedItem } from "@/features/support-needed/queries";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const alice = { id: "u1", name: "Alice", email: "alice@test.com" };
const bob   = { id: "u2", name: "Bob",   email: "bob@test.com" };

function item(overrides: Partial<SupportNeedItem> & { id: string }): SupportNeedItem {
  return {
    id: overrides.id,
    text: overrides.text ?? "Default support text",
    resolved: overrides.resolved ?? false,
    date: overrides.date ?? new Date("2026-05-28T00:00:00Z"),
    entryId: overrides.entryId ?? "entry-1",
    raisedBy: overrides.raisedBy ?? alice,
    supportFrom: overrides.supportFrom ?? null,
    comments: overrides.comments ?? [],
  };
}

const openAlice  = item({ id: "1", text: "Need OAuth key access from DevSecOps",    resolved: false, supportFrom: alice });
const resolvedBob = item({ id: "2", text: "Checkout flow review pending from Bob",    resolved: true,  supportFrom: bob });
const openNoUser = item({ id: "3", text: "Environment refresh request",              resolved: false, supportFrom: null });
const openBob    = item({ id: "4", text: "API spec sign-off from Bob",               resolved: false, supportFrom: bob });

const all = [openAlice, resolvedBob, openNoUser, openBob];

// ── daysOpen ──────────────────────────────────────────────────────────────────

describe("daysOpen (support)", () => {
  it("returns 0 for today", () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    expect(daysOpen(today)).toBe(0);
  });

  it("returns 2 for two days ago", () => {
    const d = new Date(Date.now() - 2 * 86400000);
    expect(daysOpen(d)).toBe(2);
  });

  it("never goes negative for future dates", () => {
    expect(daysOpen(new Date(Date.now() + 86400000))).toBe(0);
  });
});

// ── filterSupport — status ────────────────────────────────────────────────────

describe("filterSupport — status filter", () => {
  it("all: returns everything", () => {
    expect(filterSupport(all, "all", "")).toHaveLength(4);
  });

  it("in_progress: only unresolved items", () => {
    const result = filterSupport(all, "in_progress", "");
    expect(result.every((s) => !s.resolved)).toBe(true);
    expect(result).toHaveLength(3);
  });

  it("resolved: only resolved items", () => {
    const result = filterSupport(all, "resolved", "");
    expect(result.every((s) => s.resolved)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("empty list always returns empty", () => {
    expect(filterSupport([], "in_progress", "")).toEqual([]);
  });
});

// ── filterSupport — search ────────────────────────────────────────────────────

describe("filterSupport — search", () => {
  it("matches item text case-insensitively", () => {
    const result = filterSupport(all, "all", "oauth");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("matches supportFrom user name", () => {
    const result = filterSupport(all, "all", "bob");
    expect(result).toHaveLength(2); // resolvedBob + openBob
    expect(result.map((s) => s.id).sort()).toEqual(["2", "4"].sort());
  });

  it("matches supportFrom email when name is null", () => {
    const emailUser = { id: "u3", name: null, email: "charlie@company.com" };
    const s = item({ id: "5", text: "Needs review", supportFrom: emailUser });
    expect(filterSupport([s], "all", "charlie")).toHaveLength(1);
  });

  it("empty search returns all items", () => {
    expect(filterSupport(all, "all", "")).toHaveLength(4);
  });

  it("no match returns empty", () => {
    expect(filterSupport(all, "all", "xyzzy-not-found")).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(filterSupport(all, "all", "DEVSEOPS")).toHaveLength(0); // typo → no match
    expect(filterSupport(all, "all", "DEVSECOPS")).toHaveLength(1);
  });
});

// ── filterSupport — combined ──────────────────────────────────────────────────

describe("filterSupport — combined filters", () => {
  it("in_progress + search=bob returns unresolved items mentioning Bob", () => {
    const result = filterSupport(all, "in_progress", "bob");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("4");
  });

  it("resolved + search=bob returns the one resolved Bob item", () => {
    const result = filterSupport(all, "resolved", "bob");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });
});

// ── Visibility rules (pure-logic documentation) ────────────────────────────────

describe("Visibility scoping rules (documented)", () => {
  // The actual DB scoping is in server queries, but we document the logic here.

  it("team member sees only own items — filtered where entry.userId === sessionUserId", () => {
    const mine  = item({ id: "a", raisedBy: { id: "me",    name: "Me",    email: "me@co.com" } });
    const other = item({ id: "b", raisedBy: { id: "other", name: "Other", email: "other@co.com" } });
    const myUserId = "me";
    const teamMemberView = [mine, other].filter((s) => s.raisedBy.id === myUserId);
    expect(teamMemberView).toHaveLength(1);
    expect(teamMemberView[0].id).toBe("a");
  });

  it("manager sees all items — no user filter applied", () => {
    const mine  = item({ id: "a", raisedBy: { id: "me",    name: "Me",    email: "me@co.com" } });
    const other = item({ id: "b", raisedBy: { id: "other", name: "Other", email: "other@co.com" } });
    const managerView = [mine, other]; // no filter
    expect(managerView).toHaveLength(2);
  });
});
