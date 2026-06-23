import { describe, it, expect } from "vitest";

// ── Support Needed permission rules (mirrors server action guard logic) ───────
// Resolving a support need is a manager-only decision. Owners (and managers)
// may post progress comments/updates, but only a manager can flip `resolved`.
// Mirrors the equivalent Blocker rules in blocker-permissions.test.ts.

type Role = "TEAM_MEMBER" | "MANAGER";

function canResolveSupportNeed(role: Role): boolean {
  return role === "MANAGER";
}

function canCommentOnSupportNeed(role: Role, isOwner: boolean): boolean {
  return role === "MANAGER" || isOwner;
}

describe("Support Needed resolve guard — manager only", () => {
  it("allows a manager to resolve", () => {
    expect(canResolveSupportNeed("MANAGER")).toBe(true);
  });

  it("blocks a team member from resolving, even if they own the support need", () => {
    expect(canResolveSupportNeed("TEAM_MEMBER")).toBe(false);
  });
});

describe("Support Needed comment guard — owner or manager", () => {
  it("allows the owning team member to comment on their own support need", () => {
    expect(canCommentOnSupportNeed("TEAM_MEMBER", true)).toBe(true);
  });

  it("blocks a team member from commenting on someone else's support need (e.g. one mentioning them)", () => {
    expect(canCommentOnSupportNeed("TEAM_MEMBER", false)).toBe(false);
  });

  it("allows a manager to comment on any support need", () => {
    expect(canCommentOnSupportNeed("MANAGER", false)).toBe(true);
    expect(canCommentOnSupportNeed("MANAGER", true)).toBe(true);
  });
});
