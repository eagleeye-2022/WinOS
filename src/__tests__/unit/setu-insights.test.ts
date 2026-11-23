import { describe, expect, it } from "vitest";
import { MOCK_CALLS, MOCK_DEALS, MOCK_MEETINGS, MOCK_NOTES, MOCK_PROPOSALS, MOCK_TIME_LOGS } from "@/features/setu/data/mock-setu";
import {
  DEALS_STAGES,
  LEAD_STAGES,
  buildContacts,
  changePct,
  followUps,
  monthlySeries,
  previousMonth,
  inPeriod,
  isLead,
  matchesText,
  ownerLeaderboard,
  pipelineStats,
  recentActivity,
  stageBreakdown,
  toCsv,
} from "@/features/setu/insights";
import type { Deal } from "@/features/setu/types";

const deal = (over: Partial<Deal>): Deal => ({
  id: "x",
  leadCode: "LD-2026-0001",
  title: "",
  company: "Acme",
  contactName: "Asha",
  contactRole: "",
  phone: "",
  email: "",
  location: "",
  source: "",
  stage: "LEAD",
  ownerId: "u1",
  ownerName: "Vamshi",
  remark: "",
  updatedAt: "2026-11-20T10:00:00+05:30",
  ...over,
});

describe("lead / deal split", () => {
  it("splits the board at Proposal", () => {
    expect(LEAD_STAGES).toEqual(["LEAD", "MEETING", "DISCUSSION"]);
    expect(DEALS_STAGES).toEqual(["PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"]);
    expect(isLead({ stage: "DISCUSSION" })).toBe(true);
    expect(isLead({ stage: "PROPOSAL" })).toBe(false);
  });
});

describe("pipeline", () => {
  const deals = [
    deal({ id: "a", stage: "LEAD", value: 100 }),
    deal({ id: "b", stage: "NEGOTIATION", value: 400, ownerId: "u2", ownerName: "Priya" }),
    deal({ id: "c", stage: "CLOSED_WON", value: 1000 }),
    deal({ id: "d", stage: "CLOSED_WON", value: 500, ownerId: "u2", ownerName: "Priya" }),
    deal({ id: "e", stage: "CLOSED_LOST", value: 900 }),
  ];

  it("totals open value, wins and win rate", () => {
    expect(pipelineStats(deals)).toEqual({ openValue: 500, openCount: 2, leadCount: 1, wonValue: 1500, wonCount: 2, lostCount: 1, winRate: 67, avgWon: 750 });
    expect(pipelineStats([deal({})]).winRate).toBeNull();
  });

  it("breaks down count and value per stage in board order", () => {
    const rows = stageBreakdown(deals);
    expect(rows.map((r) => r.stage)).toEqual(["LEAD", "MEETING", "DISCUSSION", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"]);
    expect(rows.find((r) => r.stage === "CLOSED_WON")).toEqual({ stage: "CLOSED_WON", count: 2, value: 1500 });
  });

  it("ranks reps by closed-won value", () => {
    expect(ownerLeaderboard(deals).map((r) => [r.ownerName, r.wonValue, r.open])).toEqual([
      ["Vamshi", 1000, 1],
      ["Priya", 500, 1],
    ]);
  });

  it("lists follow-ups due within a week, overdue first, open records only", () => {
    const list = followUps(
      [
        deal({ id: "late", dueDate: "2026-11-20" }),
        deal({ id: "soon", dueDate: "2026-11-25" }),
        deal({ id: "far", dueDate: "2026-12-30" }),
        deal({ id: "won", stage: "CLOSED_WON", dueDate: "2026-11-24" }),
      ],
      "2026-11-23"
    );
    expect(list.map((f) => [f.deal.id, f.overdue])).toEqual([
      ["late", true],
      ["soon", false],
    ]);
  });
});

describe("contacts", () => {
  it("merges decision makers and meeting attendees by email", () => {
    const contacts = buildContacts(MOCK_DEALS, MOCK_MEETINGS);
    const rahul = contacts.filter((c) => c.email === "rahul@abctech.com");
    expect(rahul).toHaveLength(1);
    // Rahul is the decision maker on a lead (d-01) and a negotiation (d-abc): an active deal, opened on d-abc.
    expect(rahul[0].relationship).toBe("ACTIVE_DEAL");
    expect(rahul[0].dealIds.sort()).toEqual(["d-01", "d-abc"]);
    expect(rahul[0].primaryDealId).toBe("d-abc");
    // Neha only appears as a meeting attendee.
    expect(contacts.find((c) => c.email === "neha@abctech.com")?.dealIds).toEqual(["d-abc"]);
  });

  it("marks customers from closed-won deals", () => {
    const contacts = buildContacts([deal({ id: "w", stage: "CLOSED_WON", email: "a@x.com" })], []);
    expect(contacts[0].relationship).toBe("CUSTOMER");
  });
});

describe("activity and helpers", () => {
  it("merges notes, calls, meeting events, proposals and time logs newest first", () => {
    const items = recentActivity({ notes: MOCK_NOTES, calls: MOCK_CALLS, meetings: MOCK_MEETINGS, proposals: MOCK_PROPOSALS, timeLogs: MOCK_TIME_LOGS }, 5);
    expect(items).toHaveLength(5);
    expect(items.map((i) => i.at)).toEqual([...items.map((i) => i.at)].sort().reverse());
  });

  it("filters by period in IST", () => {
    expect(inPeriod("2026-11-23T01:00:00+05:30", "today", "2026-11-23")).toBe(true);
    expect(inPeriod("2026-11-17", "week", "2026-11-23")).toBe(true);
    expect(inPeriod("2026-11-16", "week", "2026-11-23")).toBe(false);
    expect(inPeriod("2026-10-05", "quarter", "2026-11-23")).toBe(true);
    expect(inPeriod("2026-09-30", "quarter", "2026-11-23")).toBe(false);
    expect(inPeriod(undefined, "month", "2026-11-23")).toBe(false);
  });

  it("builds a 12-month series for one year in IST", () => {
    const s = monthlySeries(
      [
        { at: "2026-01-31T20:00:00Z", value: 5 }, // 1 Feb in IST
        { at: "2026-11-02", value: 3 },
        { at: "2025-11-02", value: 100 }, // other year — ignored
        { at: undefined, value: 9 },
      ],
      2026
    );
    expect(s).toHaveLength(12);
    expect(s[1]).toBe(5);
    expect(s[10]).toBe(3);
    expect(s.reduce((n, v) => n + v, 0)).toBe(8);
  });

  it("computes month-over-month change", () => {
    expect(changePct(150, 100)).toBe(50);
    expect(changePct(50, 100)).toBe(-50);
    expect(changePct(10, 0)).toBeNull();
    expect(previousMonth("2026-01-15")).toBe("2025-12");
    expect(previousMonth("2026-11-23")).toBe("2026-10");
  });

  it("matches text and writes CSV", () => {
    expect(matchesText("abc", "ABC Technologies", undefined)).toBe(true);
    expect(matchesText("", undefined)).toBe(true);
    expect(toCsv([["a", 'b "c"', undefined], [1, "x,y", null]])).toBe('a,"b ""c""",\n1,"x,y",');
  });
});
