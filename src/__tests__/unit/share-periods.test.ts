import { describe, expect, it } from "vitest";
import { resolveSharePeriod } from "@/features/projects/utils/share-periods";
import {
  issueProjectEffortShareToken,
  verifyProjectEffortShareToken,
} from "@/lib/project-effort-share-token";

// Wednesday, 21 Oct 2026
const TODAY = new Date(2026, 9, 21, 15, 30);

describe("resolveSharePeriod", () => {
  it("resolves single days", () => {
    expect(resolveSharePeriod("today", TODAY)).toEqual({ from: "2026-10-21", to: "2026-10-21" });
    expect(resolveSharePeriod("yesterday", TODAY)).toEqual({ from: "2026-10-20", to: "2026-10-20" });
  });

  it("resolves weeks (Monday start) and rolling 7 days", () => {
    expect(resolveSharePeriod("this_week", TODAY)).toEqual({ from: "2026-10-19", to: "2026-10-21" });
    expect(resolveSharePeriod("last_week", TODAY)).toEqual({ from: "2026-10-12", to: "2026-10-18" });
    expect(resolveSharePeriod("last_7", TODAY)).toEqual({ from: "2026-10-15", to: "2026-10-21" });
  });

  it("resolves months and rolling 30 days", () => {
    expect(resolveSharePeriod("this_month", TODAY)).toEqual({ from: "2026-10-01", to: "2026-10-21" });
    expect(resolveSharePeriod("last_month", TODAY)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(resolveSharePeriod("last_30", TODAY)).toEqual({ from: "2026-09-22", to: "2026-10-21" });
  });

  it("handles a Sunday and a January (year boundary)", () => {
    const sunday = new Date(2026, 9, 25);
    expect(resolveSharePeriod("this_week", sunday)).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    const jan = new Date(2027, 0, 5);
    expect(resolveSharePeriod("last_month", jan)).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});

describe("project effort share token", () => {
  const base = { projectId: "p1", sharedBy: "u1", scope: "all" as const, from: "2026-10-01", to: "2026-10-07" };

  it("round-trips a valid token", () => {
    const token = issueProjectEffortShareToken({ ...base, expiresAt: null });
    expect(verifyProjectEffortShareToken(token)).toEqual({ status: "ok", payload: { ...base, expiresAt: null } });
  });

  it("rejects a tampered token and an expired one", () => {
    const token = issueProjectEffortShareToken({ ...base, expiresAt: null });
    const [, sig] = token.split(".");
    const forged = `${Buffer.from("p2|u1|all|2026-10-01|2026-10-07|0").toString("base64url")}.${sig}`;
    expect(verifyProjectEffortShareToken(forged).status).toBe("invalid");
    const expired = issueProjectEffortShareToken({ ...base, expiresAt: Date.now() - 1000 });
    expect(verifyProjectEffortShareToken(expired).status).toBe("expired");
  });
});
