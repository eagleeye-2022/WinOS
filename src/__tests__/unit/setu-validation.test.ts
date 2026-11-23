import { describe, expect, it } from "vitest";
import { checkAttendee, checkCall, checkDealInput, checkLost, checkMeeting, checkProposal, checkWon, isValidDate } from "@/features/setu/validation";
import { checkUploadedFiles, isAllowedSetuFile } from "@/features/setu/server/files";

const lead = {
  company: " ABC ",
  contactName: "Rahul",
  phone: "+91-98745 63210",
  email: "rahul@abc.com",
  location: "Hyderabad",
  stage: "LEAD" as const,
};

describe("deal input", () => {
  it("trims and fills defaults", () => {
    const r = checkDealInput(lead);
    expect(r.ok && r.value).toMatchObject({ company: "ABC", contactRole: "Decision Maker", source: "", value: undefined });
  });

  it("rejects bad phone, email, stage and amounts", () => {
    expect(checkDealInput({ ...lead, phone: "123" }).ok).toBe(false);
    expect(checkDealInput({ ...lead, email: "nope" }).ok).toBe(false);
    expect(checkDealInput({ ...lead, stage: "WON" as never }).ok).toBe(false);
    expect(checkDealInput({ ...lead, value: -5 }).ok).toBe(false);
    expect(checkDealInput({ ...lead, value: 3e9 }).ok).toBe(false);
  });
});

describe("calls", () => {
  const call = {
    title: "Intro",
    direction: "OUTBOUND" as const,
    outcome: "CONNECTED" as const,
    startedAt: "2026-11-23T10:00:00+05:30",
    endedAt: "2026-11-23T10:20:00+05:30",
    repId: "u1",
    contactName: "Rahul",
    summary: "",
  };
  it("accepts a valid call and rejects reversed times / bad links", () => {
    expect(checkCall(call).ok).toBe(true);
    expect(checkCall({ ...call, endedAt: "2026-11-23T09:00:00+05:30" }).ok).toBe(false);
    expect(checkCall({ ...call, recordingUrl: "javascript:alert(1)" }).ok).toBe(false);
  });
});

describe("meetings", () => {
  const meeting = {
    title: "Demo",
    channel: "GOOGLE_MEET" as const,
    startAt: "2026-11-24T11:00:00+05:30",
    endAt: "2026-11-24T12:00:00+05:30",
    attendees: [],
  };
  it("needs end after start except for drafts", () => {
    const same = { ...meeting, endAt: meeting.startAt };
    expect(checkMeeting(same, "UPCOMING").ok).toBe(false);
    expect(checkMeeting(same, "DRAFT").ok).toBe(true);
  });

  it("needs a location for in-person meetings and drops the link", () => {
    expect(checkMeeting({ ...meeting, channel: "IN_OFFICE" }, "UPCOMING").ok).toBe(false);
    const r = checkMeeting({ ...meeting, channel: "IN_OFFICE", location: "HQ", link: "https://x.y" }, "UPCOMING");
    expect(r.ok && r.value).toMatchObject({ location: "HQ", link: undefined });
  });

  it("requires team attendees to be users and validates guest emails", () => {
    expect(checkAttendee({ name: "Priya", external: false }).ok).toBe(false);
    expect(checkAttendee({ name: "Priya", external: false, userId: "u2" }).ok).toBe(true);
    expect(checkAttendee({ name: "Guest", external: true, email: "bad" }).ok).toBe(false);
    const g = checkAttendee({ name: "Guest", external: true, userId: "u9" });
    expect(g.ok && g.value).toMatchObject({ userId: undefined, source: "GUEST", rsvp: "PENDING" });
  });
});

describe("proposals and closure", () => {
  it("needs a title and a quote", () => {
    expect(checkProposal({ title: "", value: 1 }).ok).toBe(false);
    expect(checkProposal({ title: "V4", value: 0 }).ok).toBe(false);
    expect(checkProposal({ title: "V4", value: 425000.4 }).ok && true).toBe(true);
  });

  it("checks won details", () => {
    const won = { finalValue: 450000, advanceReceived: 225000, closedDate: "2026-11-20", contractTerm: "1-Year Term", paymentTerms: "50/50" };
    expect(checkWon(won).ok).toBe(true);
    expect(checkWon({ ...won, advanceReceived: 500000 }).ok).toBe(false);
    expect(checkWon({ ...won, contractTerm: "Forever" }).ok).toBe(false);
    expect(checkWon({ ...won, closedDate: "2026-02-30" }).ok).toBe(false);
  });

  it("checks lost details", () => {
    const lost = { primaryReason: "Pricing Too High", closedDate: "2026-11-20", lostValue: 1000 };
    expect(checkLost(lost).ok).toBe(true);
    expect(checkLost({ ...lost, primaryReason: "Because" }).ok).toBe(false);
    expect(checkLost({ ...lost, reengageDate: "2026-11-01" }).ok).toBe(false);
  });

  it("validates calendar dates strictly", () => {
    expect(isValidDate("2026-11-23")).toBe(true);
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("23/11/2026")).toBe(false);
  });
});

describe("uploaded files", () => {
  it("only allows PDF / DOC / DOCX up to 25MB", () => {
    expect(isAllowedSetuFile("a.pdf", 10)).toBeNull();
    expect(isAllowedSetuFile("a.exe", 10)).not.toBeNull();
    expect(isAllowedSetuFile("a.pdf", 26 * 1024 * 1024)).not.toBeNull();
  });

  it("only records files that came from the upload route", () => {
    expect(checkUploadedFiles([{ name: "a.pdf", size: 10, url: "/api/uploads/setu-1-a.pdf", id: "upload-x" }])).toEqual({
      ok: true,
      value: [{ id: undefined, name: "a.pdf", size: 10, url: "/api/uploads/setu-1-a.pdf" }],
    });
    expect(checkUploadedFiles([{ name: "a.pdf", size: 10, url: "https://evil.example/a.pdf" }]).ok).toBe(false);
    expect(checkUploadedFiles([{ name: "a.pdf", size: 10, url: "/api/uploads/../../etc/passwd" }]).ok).toBe(false);
  });
});
