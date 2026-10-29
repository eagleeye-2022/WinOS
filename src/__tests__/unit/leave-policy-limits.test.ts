import { describe, it, expect, vi } from "vitest";

// team-scope / approval-flow import the Prisma client; only their pure helpers are tested here.
vi.mock("@/lib/db", () => ({ db: {} }));

import {
  accruedAllocation,
  carryForwardFrom,
  checkEligibility,
  checkRequestLimits,
  validCompOffDays,
  type EligibilityPolicy,
  type EmployeeFacts,
  type LimitPolicy,
} from "@/features/leave/leave-rules";
import { managedIdsFrom } from "@/features/attendance/team-scope";
import { approvalStepsFor } from "@/features/leave/approval-flow";
import { dateFromKey } from "@/features/attendance/utils";

const d = (k: string) => dateFromKey(k)!;

function eligibility(over: Partial<EligibilityPolicy> = {}): EligibilityPolicy {
  return {
    name: "Casual Leave",
    applicableTo: "ALL_EMPLOYEES",
    departments: [],
    employmentTypes: [],
    minServicePeriod: 0,
    minServiceUnit: "MONTHS",
    ...over,
  };
}

function emp(over: Partial<EmployeeFacts> = {}): EmployeeFacts {
  return {
    department: "Engineering",
    employmentType: "Permanent",
    profileRole: "EMPLOYEE",
    dateOfJoining: d("2025-01-01"),
    dateOfConfirmation: d("2025-07-01"),
    ...over,
  };
}

describe("checkEligibility", () => {
  it("allows everyone by default", () => {
    expect(checkEligibility(eligibility(), emp(), "2026-10-29")).toBeNull();
  });
  it("restricts by department and employment type (case-insensitive)", () => {
    expect(checkEligibility(eligibility({ departments: ["engineering"] }), emp(), "2026-10-29")).toBeNull();
    expect(checkEligibility(eligibility({ departments: ["HR"] }), emp(), "2026-10-29")).toMatch(/only for HR/);
    expect(checkEligibility(eligibility({ employmentTypes: ["Intern"] }), emp(), "2026-10-29")).toMatch(/Intern/);
  });
  it("never blocks on facts the profile doesn't have", () => {
    expect(checkEligibility(eligibility({ departments: ["HR"] }), emp({ department: null }), "2026-10-29")).toBeNull();
    expect(checkEligibility(eligibility({ minServicePeriod: 6 }), emp({ dateOfJoining: null }), "2026-10-29")).toBeNull();
  });
  it("enforces the minimum service period", () => {
    const p = eligibility({ minServicePeriod: 6, minServiceUnit: "MONTHS" });
    expect(checkEligibility(p, emp({ dateOfJoining: d("2026-08-01") }), "2026-10-29")).toMatch(/after 6 months/);
    expect(checkEligibility(p, emp({ dateOfJoining: d("2026-01-01") }), "2026-10-29")).toBeNull();
  });
  it("handles audience rules", () => {
    expect(checkEligibility(eligibility({ applicableTo: "FULL_TIME_ONLY" }), emp({ employmentType: "Intern" }), "2026-10-29")).toMatch(/full-time/);
    expect(checkEligibility(eligibility({ applicableTo: "PROBATIONARY" }), emp(), "2026-10-29")).toMatch(/probation/);
    expect(checkEligibility(eligibility({ applicableTo: "PROBATIONARY" }), emp({ dateOfConfirmation: null }), "2026-10-29")).toBeNull();
  });
});

function limits(over: Partial<LimitPolicy> = {}): LimitPolicy {
  return {
    name: "Casual Leave",
    code: "CL",
    minGapBetweenRequests: 0,
    maxRequestsCount: 0,
    maxRequestsPeriod: "MONTHS",
    clubbingRestrictedCodes: [],
    ...over,
  };
}

describe("checkRequestLimits", () => {
  it("enforces the gap between requests of the same type", () => {
    const others = [{ code: "CL", fromKey: "2026-10-26", toKey: "2026-10-26" }];
    expect(checkRequestLimits(limits({ minGapBetweenRequests: 2 }), "2026-10-28", "2026-10-28", others)).toMatch(/at least 2 days/);
    expect(checkRequestLimits(limits({ minGapBetweenRequests: 2 }), "2026-10-29", "2026-10-29", others)).toBeNull();
    // Other leave types don't count for the gap.
    expect(checkRequestLimits(limits({ minGapBetweenRequests: 2 }), "2026-10-27", "2026-10-27", [{ ...others[0], code: "SL" }])).toBeNull();
  });
  it("caps requests per calendar month", () => {
    const others = [
      { code: "CL", fromKey: "2026-10-05", toKey: "2026-10-05" },
      { code: "CL", fromKey: "2026-10-12", toKey: "2026-10-12" },
    ];
    expect(checkRequestLimits(limits({ maxRequestsCount: 2 }), "2026-10-20", "2026-10-20", others)).toMatch(/at most 2 requests per month/);
    expect(checkRequestLimits(limits({ maxRequestsCount: 2 }), "2026-11-02", "2026-11-02", others)).toBeNull();
  });
  it("blocks clubbing with restricted types on the adjacent working day", () => {
    const p = limits({ clubbingRestrictedCodes: ["SL", "CL"] });
    // SL on Friday 30th, CL on Monday 2nd (weekend in between) → adjacent working days.
    expect(checkRequestLimits(p, "2026-11-02", "2026-11-02", [{ code: "SL", fromKey: "2026-10-30", toKey: "2026-10-30" }])).toMatch(/combined with SL/);
    expect(checkRequestLimits(p, "2026-11-04", "2026-11-04", [{ code: "SL", fromKey: "2026-10-30", toKey: "2026-10-30" }])).toBeNull();
  });
});

describe("balance calendar", () => {
  it("accrues monthly and quarterly allocations", () => {
    expect(accruedAllocation("MONTHLY", 12, 12, "2026-03-15")).toBe(3);
    expect(accruedAllocation("QUARTERLY", 12, 12, "2026-05-01")).toBe(6);
    expect(accruedAllocation("YEARLY", 12, 12, "2026-01-02")).toBe(12);
    // Extra credits above the entitlement are available at once.
    expect(accruedAllocation("MONTHLY", 14, 12, "2026-01-10")).toBe(3);
  });
  it("carries forward up to the limit", () => {
    const prev = { allocatedDays: 12, carriedForward: 0, adjustedDays: 0, bookedDays: 4 };
    const policy = { allowCarryForward: true, carryForwardLimit: 5, balanceResetRule: "CARRY_FORWARD_UP_TO_LIMIT" };
    expect(carryForwardFrom(prev, policy)).toBe(5);
    expect(carryForwardFrom({ ...prev, bookedDays: 10 }, policy)).toBe(2);
    expect(carryForwardFrom(prev, { ...policy, balanceResetRule: "LAPSE_ALL" })).toBe(0);
    expect(carryForwardFrom(null, policy)).toBe(0);
  });
  it("drops comp-off credits that expired unused", () => {
    const credits = [
      { days: 1, expiryKey: "2026-09-30" },
      { days: 1, expiryKey: "2026-11-30" },
    ];
    expect(validCompOffDays(credits, 0, "2026-10-15")).toBe(1); // first expired unused
    expect(validCompOffDays(credits, 1, "2026-10-15")).toBe(1); // first was used before expiring
    expect(validCompOffDays(credits, 0, "2026-09-15")).toBe(2);
    expect(validCompOffDays(credits, 2, "2026-09-15")).toBe(0);
  });
});

describe("team scope", () => {
  const org = [
    { id: "boss", reportingToId: null, secondaryReportingToId: null },
    { id: "lead", reportingToId: "boss", secondaryReportingToId: null },
    { id: "dev", reportingToId: "lead", secondaryReportingToId: null },
    { id: "other", reportingToId: "x-manager", secondaryReportingToId: null },
    { id: "loose", reportingToId: null, secondaryReportingToId: null },
  ];
  it("covers the reporting tree and unassigned people", () => {
    expect([...managedIdsFrom("boss", org)].sort()).toEqual(["dev", "lead", "loose"]);
    // The boss is the top of a tree: only admins handle them…
    expect([...managedIdsFrom("lead", org)].sort()).toEqual(["dev", "loose"]);
  });
  it("lets managers handle a top-of-tree boss when the org has no admin", () => {
    expect([...managedIdsFrom("lead", org, true)].sort()).toEqual(["boss", "dev", "loose"]);
  });
  it("doesn't include people under another manager", () => {
    expect(managedIdsFrom("lead", org).has("other")).toBe(false);
  });
});

describe("approvalStepsFor", () => {
  it("maps each flow to its steps", () => {
    expect(approvalStepsFor("DIRECT_MANAGER", true).map((s) => s.approverRole)).toEqual(["Reporting Manager"]);
    expect(approvalStepsFor("HR_ADMIN", true).map((s) => s.approverRole)).toEqual(["HR Admin"]);
    expect(approvalStepsFor("CUSTOM_TWO_STEP", true).map((s) => s.approverRole)).toEqual(["Reporting Manager", "HR Admin"]);
    expect(approvalStepsFor("DIRECT_MANAGER", false)).toEqual([]);
  });
});
