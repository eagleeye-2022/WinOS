import { describe, it, expect } from "vitest";

// ── Blocker permission rules (mirrors server action guard logic) ──────────────
// Resolving a blocker is a manager-only decision. Owners (and managers) may
// post progress comments/updates, but only a manager can flip `resolved`.

type Role = "TEAM_MEMBER" | "MANAGER";

function canResolveBlocker(role: Role): boolean {
  return role === "MANAGER";
}

function canCommentOnBlocker(role: Role, isOwner: boolean): boolean {
  return role === "MANAGER" || isOwner;
}

describe("Blocker resolve guard — manager only", () => {
  it("allows a manager to resolve", () => {
    expect(canResolveBlocker("MANAGER")).toBe(true);
  });

  it("blocks a team member from resolving, even if they own the blocker", () => {
    expect(canResolveBlocker("TEAM_MEMBER")).toBe(false);
  });
});

describe("Blocker comment guard — owner or manager", () => {
  it("allows the owning team member to comment on their own blocker", () => {
    expect(canCommentOnBlocker("TEAM_MEMBER", true)).toBe(true);
  });

  it("blocks a team member from commenting on someone else's blocker", () => {
    expect(canCommentOnBlocker("TEAM_MEMBER", false)).toBe(false);
  });

  it("allows a manager to comment on any blocker", () => {
    expect(canCommentOnBlocker("MANAGER", false)).toBe(true);
    expect(canCommentOnBlocker("MANAGER", true)).toBe(true);
  });
});
