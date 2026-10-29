import { describe, expect, it } from "vitest";
import { MOCK_MEETINGS, MOCK_PROSPECTS } from "@/features/setu/data/mock-setu";
import type { Prospect } from "@/features/setu/types";
import { buildContacts, computeStats, formatInrShort, initials, pipelineHealth } from "@/features/setu/utils";

const prospect = (id: string, stage: Prospect["stage"]): Prospect => ({
  id,
  name: id,
  business: "",
  connectedVia: "",
  phone: "",
  email: "",
  stage,
  source: "MANUAL",
  remark: "",
  updatedAt: "2026-10-01",
});

describe("pipelineHealth", () => {
  it("is the share of prospects not Lost or On Hold", () => {
    expect(pipelineHealth([prospect("a", "PROSPECT"), prospect("b", "WON"), prospect("c", "LOST"), prospect("d", "ON_HOLD")])).toBe(50);
  });

  it("is 0 for an empty pipeline", () => {
    expect(pipelineHealth([])).toBe(0);
  });
});

describe("computeStats", () => {
  it("sums referrals across meetings and counts won deals", () => {
    const stats = computeStats(MOCK_MEETINGS, MOCK_PROSPECTS);
    expect(stats.meetings).toBe(MOCK_MEETINGS.length);
    expect(stats.prospects).toBe(MOCK_PROSPECTS.length);
    expect(stats.refsReceived).toBe(MOCK_MEETINGS.reduce((n, m) => n + m.refsReceived, 0));
    expect(stats.won).toBe(MOCK_PROSPECTS.filter((p) => p.stage === "WON").length);
  });
});

describe("buildContacts", () => {
  it("shows a member who is also a prospect once, as the prospect", () => {
    const contacts = buildContacts(MOCK_MEETINGS, MOCK_PROSPECTS);
    const amit = contacts.filter((c) => c.name === "Amit Pandey Ji");
    expect(amit).toHaveLength(1);
    expect(amit[0].kind).toBe("PROSPECT");
    expect(amit[0].refsReceived).toBe(2);
  });
});

describe("formatters", () => {
  it("formats INR in lakhs / thousands", () => {
    expect(formatInrShort(120000)).toBe("₹1.2L");
    expect(formatInrShort(45000)).toBe("₹45k");
    expect(formatInrShort(500)).toBe("₹500");
  });

  it("builds initials without the 'Ji' honorific", () => {
    expect(initials("Shreshtha Goyal Ji")).toBe("SG");
    expect(initials("Ankur Ji")).toBe("A");
  });
});
