import { describe, expect, it } from "vitest";
import { MOCK_CALLS, MOCK_DEALS, MOCK_PROPOSALS, MOCK_TIME_LOGS } from "@/features/setu/data/mock-setu";
import type { Deal, DealCall, DealMeeting, DealNote, DealTimeLog } from "@/features/setu/types";
import {
  boardSummary,
  callStats,
  findConflicts,
  formatRange,
  inMeetingRange,
  relativeToNow,
  weekRange,
  fiscalQuarter,
  formatBytes,
  formatSpan,
  parseInr,
  percentOf,
  proposalSummary,
  istDateTime,
  istHhmm,
  meetingNumbers,
  meetingStats,
  nextMeetingByDeal,
  relativeDay,
  countByStage,
  dealTitle,
  displayCode,
  filterDeals,
  formatClock,
  formatDate,
  formatDateTime,
  formatDuration,
  formatHoursMinutes,
  formatInr,
  formatInrShort,
  formatTime,
  initials,
  isoDate,
  matchesDue,
  nextCode,
  sortNotes,
  timeLogStats,
  timeLogsCsv,
} from "@/features/setu/utils";

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
  ownerId: "u-1",
  ownerName: "Vamshi R.",
  remark: "",
  updatedAt: "2026-11-20T10:00:00+05:30",
  ...over,
});

const NO_FILTERS = { q: "", owner: "", due: "any" as const, related: "all" as const };

describe("codes and titles", () => {
  it("shows the LD code before Proposal and the DEAL code from Proposal on", () => {
    expect(displayCode(deal({ stage: "DISCUSSION", dealCode: "DEAL-2026-0001" }))).toBe("LD-2026-0001");
    expect(displayCode(deal({ stage: "PROPOSAL", dealCode: "DEAL-2026-0001" }))).toBe("DEAL-2026-0001");
    expect(displayCode(deal({ stage: "PROPOSAL" }))).toBe("LD-2026-0001");
  });

  it("titles a lead by its contact and a deal by its title", () => {
    expect(dealTitle(deal({ stage: "LEAD", title: "Website" }))).toBe("Asha");
    expect(dealTitle(deal({ stage: "PROPOSAL", title: "Website" }))).toBe("Website");
    expect(dealTitle(deal({ stage: "PROPOSAL", title: "" }))).toBe("Acme");
  });

  it("numbers codes after the highest in the year", () => {
    expect(nextCode("LD", ["LD-2026-0042", "LD-2026-0007", "LD-2025-0100", undefined], 2026)).toBe("LD-2026-0043");
    expect(nextCode("DEAL", [], 2026)).toBe("DEAL-2026-0001");
  });
});

describe("board filters", () => {
  const deals = [
    deal({ id: "a", stage: "LEAD", company: "Bluefin", ownerName: "Priya", dueDate: "2026-11-23" }),
    deal({ id: "b", stage: "PROPOSAL", company: "Craftbox", value: 100000 }),
    deal({ id: "c", stage: "CLOSED_WON", company: "Hyperion", value: 50000 }),
  ];

  it("searches company, contact, codes and notes", () => {
    expect(filterDeals(deals, { ...NO_FILTERS, q: "craft" }, "2026-11-23").map((d) => d.id)).toEqual(["b"]);
  });

  it("filters by owner and lead / deal", () => {
    expect(filterDeals(deals, { ...NO_FILTERS, owner: "Priya" }, "2026-11-23").map((d) => d.id)).toEqual(["a"]);
    expect(filterDeals(deals, { ...NO_FILTERS, related: "lead" }, "2026-11-23").map((d) => d.id)).toEqual(["a"]);
    expect(filterDeals(deals, { ...NO_FILTERS, related: "deal" }, "2026-11-23").map((d) => d.id)).toEqual(["b", "c"]);
  });

  it("matches due-date windows", () => {
    expect(matchesDue("2026-11-22", "overdue", "2026-11-23")).toBe(true);
    expect(matchesDue("2026-11-23", "today", "2026-11-23")).toBe(true);
    expect(matchesDue("2026-11-29", "week", "2026-11-23")).toBe(true);
    expect(matchesDue("2026-11-30", "week", "2026-11-23")).toBe(false);
    expect(matchesDue("2026-11-02", "month", "2026-11-23")).toBe(true);
    expect(matchesDue(undefined, "today", "2026-11-23")).toBe(false);
    expect(matchesDue(undefined, "any", "2026-11-23")).toBe(true);
  });

  it("counts per stage and summarises open deals only", () => {
    expect(countByStage(deals)).toMatchObject({ LEAD: 1, PROPOSAL: 1, CLOSED_WON: 1, MEETING: 0 });
    expect(boardSummary(deals)).toEqual({ stagesInMotion: 2, pipelineValue: 100000, activeTasks: 2 });
  });

  it("seeds a card in every column", () => {
    const counts = countByStage(MOCK_DEALS);
    expect(Object.values(counts).every((n) => n > 0)).toBe(true);
  });
});

describe("notes", () => {
  it("puts pinned notes first, then newest", () => {
    const n = (id: string, pinned: boolean, createdAt: string): DealNote => ({ id, dealId: "d", category: "NOTE", title: id, body: "", pinned, authorId: "u", authorName: "", createdAt });
    const sorted = sortNotes([n("old", false, "2026-10-01T10:00:00Z"), n("pin", true, "2026-09-01T10:00:00Z"), n("new", false, "2026-10-05T10:00:00Z")]);
    expect(sorted.map((x) => x.id)).toEqual(["pin", "new", "old"]);
  });
});

describe("time logs", () => {
  const log = (startedAt: string, endedAt: string, employeeName = "A"): DealTimeLog => ({ id: startedAt, dealId: "d", userId: "u", employeeName, reason: "Call, follow-up", startedAt, endedAt });

  it("totals time, today's time, sessions and contributors", () => {
    const logs = [
      log("2026-11-23T10:00:00+05:30", "2026-11-23T10:30:00+05:30", "A"),
      log("2026-11-22T10:00:00+05:30", "2026-11-22T11:00:00+05:30", "B"),
    ];
    expect(timeLogStats(logs, "2026-11-23")).toEqual({ totalSeconds: 5400, todaySeconds: 1800, sessions: 2, employees: 2 });
  });

  it("matches the design's seeded total for ABC Technologies", () => {
    const abc = MOCK_TIME_LOGS.filter((l) => l.dealId === "d-abc");
    expect(formatHoursMinutes(timeLogStats(abc, "2026-11-23").totalSeconds)).toBe("4h 20m");
  });

  it("exports CSV with quoted cells", () => {
    const csv = timeLogsCsv([log("2026-10-04T10:42:00+05:30", "2026-10-04T11:06:36+05:30")]);
    expect(csv.split("\n")[1]).toBe('04 Oct 2026,A,"Call, follow-up",10:42 AM,11:06 AM,24m 36s');
  });
});

describe("meetings and calls", () => {
  const meeting = (id: string, dealId: string, startAt: string, status: DealMeeting["status"], over: Partial<DealMeeting> = {}): DealMeeting => ({
    id,
    dealId,
    title: id,
    type: "Demo",
    startAt,
    endAt: startAt,
    hostId: "u-h",
    hostName: "H",
    channel: "GOOGLE_MEET",
    agenda: "",
    attendees: [],
    status,
    reminder: "30m",
    history: [],
    ...over,
  });

  it("picks each deal's soonest upcoming meeting", () => {
    const next = nextMeetingByDeal([
      meeting("late", "d1", "2026-11-30T10:00:00+05:30", "UPCOMING"),
      meeting("soon", "d1", "2026-11-24T10:00:00+05:30", "UPCOMING"),
      meeting("done", "d1", "2026-11-01T10:00:00+05:30", "COMPLETED"),
    ]);
    expect(next.get("d1")?.id).toBe("soon");
  });

  it("lets a scheduled meeting drive the board's due-date filter and search", () => {
    const deals = [deal({ id: "d1", stage: "MEETING" })];
    const next = nextMeetingByDeal([meeting("Kickoff Call", "d1", "2026-11-23T17:00:00+05:30", "UPCOMING")]);
    expect(filterDeals(deals, { ...NO_FILTERS, due: "today" }, "2026-11-23", next)).toHaveLength(1);
    expect(filterDeals(deals, { ...NO_FILTERS, q: "kickoff" }, "2026-11-23", next)).toHaveLength(1);
    expect(filterDeals(deals, { ...NO_FILTERS, due: "today" }, "2026-11-23")).toHaveLength(0);
  });

  it("numbers meetings in date order and counts external / virtual", () => {
    const list = [
      meeting("b", "d", "2026-10-02T10:00:00+05:30", "COMPLETED", { channel: "IN_OFFICE" }),
      meeting("a", "d", "2026-09-28T10:00:00+05:30", "COMPLETED", { attendees: [{ id: "x", name: "C", external: true }] }),
    ];
    expect(meetingNumbers(list).get("a")).toBe(1);
    expect(meetingStats(list)).toMatchObject({ total: 2, completed: 2, external: 1, virtual: 1 });
  });

  it("computes the Monday–Sunday week and range filters", () => {
    expect(weekRange("2026-09-30")).toEqual({ start: "2026-09-28", end: "2026-10-04" });
    expect(weekRange("2026-10-04")).toEqual({ start: "2026-09-28", end: "2026-10-04" });
    expect(formatRange("2026-09-28", "2026-10-04")).toBe("28 Sep – 04 Oct");
    expect(inMeetingRange("2026-10-04T23:00:00+05:30", "week", "2026-09-30")).toBe(true);
    expect(inMeetingRange("2026-10-05T09:00:00+05:30", "week", "2026-09-30")).toBe(false);
    expect(inMeetingRange("2026-10-05T09:00:00+05:30", "next7", "2026-09-30")).toBe(true);
  });

  it("describes a meeting relative to now", () => {
    const start = "2026-09-30T11:00:00+05:30";
    const end = "2026-09-30T12:00:00+05:30";
    const at = (iso: string) => Date.parse(iso);
    expect(relativeToNow(start, end, at("2026-09-30T10:45:00+05:30"))).toBe("in 15 minutes");
    expect(relativeToNow(start, end, at("2026-09-30T08:00:00+05:30"))).toBe("in 3 hours");
    expect(relativeToNow(start, end, at("2026-09-30T11:30:00+05:30"))).toBe("in progress");
    expect(relativeToNow(start, end, at("2026-09-30T14:00:00+05:30"))).toBe("ended 2 hours ago");
  });

  it("flags team members double-booked in an overlapping scheduled meeting", () => {
    const busy = meeting("busy", "d2", "2026-09-30T11:30:00+05:30", "UPCOMING", {
      endAt: "2026-09-30T12:30:00+05:30",
      hostName: "Priya Shah",
      attendees: [{ id: "x", name: "Client", external: true }],
    });
    const candidate = {
      startAt: "2026-09-30T11:00:00+05:30",
      endAt: "2026-09-30T12:00:00+05:30",
      hostName: "Amit Verma",
      attendees: [{ id: "y", name: "Priya Shah", external: false }],
    };
    expect(findConflicts([busy], candidate).map((c) => c.people)).toEqual([["Priya Shah"]]);
    // Back-to-back is fine; cancelled meetings don't block.
    expect(findConflicts([{ ...busy, startAt: "2026-09-30T12:00:00+05:30" }], candidate)).toHaveLength(0);
    expect(findConflicts([{ ...busy, status: "CANCELLED" }], candidate)).toHaveLength(0);
  });

  it("summarises calls", () => {
    const abc = MOCK_CALLS.filter((c) => c.dealId === "d-abc");
    const stats = callStats(abc);
    expect(stats).toMatchObject({ total: 4, outbound: 3, inbound: 1, withAudio: 4, connectRate: 100 });
    expect(formatHoursMinutes(stats.talkSeconds)).toBe("1h 11m");
    const missed: DealCall = { ...abc[0], id: "m", outcome: "NO_ANSWER" };
    expect(callStats([abc[0], missed]).connectRate).toBe(50);
  });

  it("labels relative days and builds IST datetimes", () => {
    expect(relativeDay("2026-11-24T11:00:00+05:30", "2026-11-23")).toBe("Tomorrow");
    expect(relativeDay("2026-11-23T01:00:00+05:30", "2026-11-23")).toBe("Today");
    expect(relativeDay("2026-11-30T11:00:00+05:30", "2026-11-23")).toBeNull();
    expect(istDateTime("2026-11-24", "11:00")).toBe("2026-11-24T11:00:00+05:30");
    expect(istHhmm("2026-11-24T05:30:00Z")).toBe("11:00");
    expect(formatSpan(3600)).toBe("1h");
    expect(formatSpan(4500)).toBe("1h 15m");
    expect(formatSpan(2700)).toBe("45m");
  });
});

describe("proposals and closure", () => {
  it("summarises proposal versions", () => {
    const abc = MOCK_PROPOSALS.filter((p) => p.dealId === "d-abc");
    const s = proposalSummary(abc);
    expect(s.active?.version).toBe(3);
    expect(s.baseline?.version).toBe(1);
    expect(s.variance).toBe(-13.5);
    expect(s.revisions).toBe(3);
    expect(s.draft).toBeUndefined();
    expect(s.nextVersion).toBe(4);
  });

  it("formats fiscal quarters, money input and file sizes", () => {
    expect(fiscalQuarter("2026-06-14")).toBe("Q1 FY27");
    expect(fiscalQuarter("2026-10-20")).toBe("Q3 FY27");
    expect(fiscalQuarter("2027-02-15")).toBe("Q4 FY27");
    expect(parseInr("₹4,50,000")).toBe(450000);
    expect(parseInr("")).toBeNaN();
    expect(percentOf(225000, 450000)).toBe(50);
    expect(formatBytes(1_800_000)).toBe("1.7 MB");
    expect(formatBytes(420_000)).toBe("410 KB");
  });
});

describe("formatters", () => {
  it("formats durations and clocks", () => {
    expect(formatDuration(1476)).toBe("24m 36s");
    expect(formatDuration(4500)).toBe("1h 15m");
    expect(formatHoursMinutes(24120)).toBe("6h 42m");
    expect(formatHoursMinutes(600)).toBe("10m");
    expect(formatClock(1477)).toBe("00:24:37");
  });

  it("formats dates and times in IST regardless of the machine timezone", () => {
    expect(formatDate("2026-10-04T17:15:00+05:30")).toBe("04 Oct 2026");
    expect(formatDate("2026-10-04")).toBe("04 Oct 2026");
    expect(formatTime("2026-10-04T11:45:00Z")).toBe("05:15 PM");
    expect(formatTime("17:00")).toBe("05:00 PM");
    expect(formatDateTime("2026-06-12T16:22:00+05:30")).toBe("12/06/2026, 04:22 PM");
    expect(isoDate("2026-11-22T20:00:00Z")).toBe("2026-11-23");
  });

  it("formats INR with Indian grouping", () => {
    expect(formatInr(450000)).toBe("₹4,50,000");
    expect(formatInrShort(3840000)).toBe("₹38.4L");
    expect(formatInrShort(45000)).toBe("₹45k");
  });

  it("builds initials", () => {
    expect(initials("Vamshi R.")).toBe("VR");
    expect(initials("Priya Shah")).toBe("PS");
  });
});
