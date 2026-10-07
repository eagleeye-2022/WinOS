import { describe, it, expect, afterEach } from "vitest";
import {
  buildCliqReportMessage,
  DEFAULT_RECORDING_HOSTS,
  formatCutoffLabel,
  formatMinutes,
  getAllowedRecordingHosts,
  computeIsLate,
  getCutoffInstant,
  getOpenReportDateStr,
  getReportConfig,
  getReportCutoff,
  getReportCutoffDayOffset,
  isReportLate,
  usableRecordingUrl,
  validateRecordingUrl,
} from "@/features/dsr/reporting";

// ── Cut-off / late ────────────────────────────────────────────────────────────

describe("report cut-off: 6:00 AM IST the next day (default)", () => {
  it("for the Oct 6 report, the cut-off is 6:00 AM IST on Oct 7 (00:30 UTC)", () => {
    expect(getCutoffInstant("2026-10-06").toISOString()).toBe("2026-10-07T00:30:00.000Z");
  });

  it("is not late in the evening of the report day", () => {
    expect(isReportLate("2026-10-06", new Date("2026-10-06T14:30:00.000Z"))).toBe(false); // 8:00 PM IST
  });

  it("is not late just after midnight", () => {
    expect(isReportLate("2026-10-06", new Date("2026-10-06T19:30:00.000Z"))).toBe(false); // 1:00 AM IST Oct 7
  });

  it("is not late exactly at 6:00 AM next day", () => {
    expect(isReportLate("2026-10-06", new Date("2026-10-07T00:30:00.000Z"))).toBe(false);
  });

  it("is late at 6:01 AM next day", () => {
    expect(isReportLate("2026-10-06", new Date("2026-10-07T00:31:00.000Z"))).toBe(true);
  });

  it("still supports a same-day cut-off (day offset 0)", () => {
    expect(getCutoffInstant("2026-10-06", "18:00", 0).toISOString()).toBe("2026-10-06T12:30:00.000Z");
    expect(isReportLate("2026-10-06", new Date("2026-10-06T12:31:00.000Z"), "18:00", 0)).toBe(true);
  });

  it("formats the cut-off label", () => {
    expect(formatCutoffLabel()).toBe("6:00 AM next day");
    expect(formatCutoffLabel("18:00", 0)).toBe("6:00 PM");
    expect(formatCutoffLabel("12:00", 0)).toBe("12:00 PM");
  });
});

describe("getOpenReportDateStr (which day's report is open)", () => {
  it("is today's report during the day", () => {
    expect(getOpenReportDateStr(new Date("2026-10-07T09:00:00.000Z"))).toBe("2026-10-07"); // 2:30 PM IST
  });

  it("is still yesterday's report between midnight and 6 AM IST", () => {
    expect(getOpenReportDateStr(new Date("2026-10-06T19:00:00.000Z"))).toBe("2026-10-06"); // 12:30 AM IST Oct 7
    expect(getOpenReportDateStr(new Date("2026-10-07T00:29:00.000Z"))).toBe("2026-10-06"); // 5:59 AM IST Oct 7
  });

  it("switches to the new day at 6:00 AM IST", () => {
    expect(getOpenReportDateStr(new Date("2026-10-07T00:30:00.000Z"))).toBe("2026-10-07");
  });

  it("with a same-day cut-off, switches at midnight IST", () => {
    expect(getOpenReportDateStr(new Date("2026-10-06T19:00:00.000Z"), "18:00", 0)).toBe("2026-10-07");
  });
});

describe("report config from env", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("defaults the cut-off to 6:00 AM next day", () => {
    delete process.env.REPORT_CUTOFF_HHMM;
    delete process.env.REPORT_CUTOFF_DAY_OFFSET;
    expect(getReportCutoff()).toBe("06:00");
    expect(getReportCutoffDayOffset()).toBe(1);
    expect(getReportConfig().cutoffLabel).toBe("6:00 AM next day");
  });

  it("reads REPORT_CUTOFF_HHMM and ignores malformed values", () => {
    process.env.REPORT_CUTOFF_HHMM = "19:15";
    expect(getReportCutoff()).toBe("19:15");
    process.env.REPORT_CUTOFF_HHMM = "7pm";
    expect(getReportCutoff()).toBe("06:00");
  });

  it("reads REPORT_CUTOFF_DAY_OFFSET (only 0 or 1)", () => {
    process.env.REPORT_CUTOFF_DAY_OFFSET = "0";
    expect(getReportCutoffDayOffset()).toBe(0);
    process.env.REPORT_CUTOFF_DAY_OFFSET = "3";
    expect(getReportCutoffDayOffset()).toBe(1);
  });

  it("reads REPORT_RECORDING_ALLOWED_HOSTS", () => {
    delete process.env.REPORT_RECORDING_ALLOWED_HOSTS;
    expect(getAllowedRecordingHosts()).toEqual(DEFAULT_RECORDING_HOSTS);
    process.env.REPORT_RECORDING_ALLOWED_HOSTS = " zoho.in , Loom.com ";
    expect(getAllowedRecordingHosts()).toEqual(["zoho.in", "loom.com"]);
  });
});

// ── Recording link validation ─────────────────────────────────────────────────

describe("validateRecordingUrl", () => {
  it("rejects an empty link", () => {
    expect(validateRecordingUrl("").ok).toBe(false);
    expect(validateRecordingUrl(null).ok).toBe(false);
    expect(validateRecordingUrl("   ").ok).toBe(false);
  });

  it("rejects non-URLs", () => {
    expect(validateRecordingUrl("my recording").ok).toBe(false);
  });

  it("rejects http links", () => {
    expect(validateRecordingUrl("http://cliq.zoho.in/abc").ok).toBe(false);
  });

  it("accepts Zoho Cliq and WorkDrive links (.in and .com)", () => {
    expect(validateRecordingUrl("https://cliq.zoho.in/company/123/chats/abc").ok).toBe(true);
    expect(validateRecordingUrl("https://workdrive.zoho.com/file/xyz").ok).toBe(true);
    expect(validateRecordingUrl("https://workdrive.zohoexternal.in/external/abc").ok).toBe(true);
  });

  it("rejects look-alike hosts", () => {
    expect(validateRecordingUrl("https://zoho.in.evil.com/x").ok).toBe(false);
    expect(validateRecordingUrl("https://notzoho.in/x").ok).toBe(false);
  });

  it("rejects hosts outside the allow-list", () => {
    const res = validateRecordingUrl("https://drive.google.com/file/d/1");
    expect(res.ok).toBe(false);
  });

  it("honours a custom allow-list", () => {
    expect(validateRecordingUrl("https://www.loom.com/share/abc", ["loom.com"]).ok).toBe(true);
  });

  it("trims whitespace and returns the normalised URL", () => {
    const res = validateRecordingUrl("  https://cliq.zoho.in/x  ");
    expect(res).toEqual({ ok: true, url: "https://cliq.zoho.in/x" });
  });
});

// ── Formatting / Cliq message ─────────────────────────────────────────────────

describe("formatMinutes", () => {
  it("formats minutes", () => {
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(135)).toBe("2h 15m");
  });
});

describe("buildCliqReportMessage", () => {
  const base = {
    memberName: "Asha",
    dateStr: "2026-10-06",
    completedTaskCount: 3,
    plannedTaskCount: 4,
    totalLoggedMinutes: 390,
    resultOfDay: "Shipped login fix",
    dayFeedback: "Good",
    suggestions: null,
    recordingUrl: "https://cliq.zoho.in/x",
    isLate: false,
    isUpdate: false,
    reportUrl: "https://winos.example/report/member/u1?date=2026-10-06",
  };

  it("includes the key facts and the recording link", () => {
    const { text } = buildCliqReportMessage(base);
    expect(text).toContain("End-of-day report: *Asha*, 2026-10-06");
    expect(text).toContain("Tasks: 3/4 done");
    expect(text).toContain("Time logged: 6h 30m");
    expect(text).toContain("Outcome: Shipped login fix");
    expect(text).toContain("How was the day: Good");
    expect(text).not.toContain("Feedback / suggestions");
    expect(text).toContain("Recording: https://cliq.zoho.in/x");
    expect(text).toContain("Full report: https://winos.example/report/member/u1?date=2026-10-06");
  });

  it("flags late and updated reports", () => {
    const { text } = buildCliqReportMessage({ ...base, isLate: true, isUpdate: true });
    expect(text.split("\n")[0]).toBe("Updated report: *Asha*, 2026-10-06 (LATE)");
  });

  it("says when the recording is missing", () => {
    const { text } = buildCliqReportMessage({ ...base, recordingUrl: null, reportUrl: null });
    expect(text).toContain("Recording: (missing)");
    expect(text).not.toContain("Full report");
  });
});

describe("usableRecordingUrl", () => {
  it("keeps real links", () => {
    expect(usableRecordingUrl("https://cliq.zoho.in/x")).toBe("https://cliq.zoho.in/x");
  });

  it("drops old in-app recorder paths and empty values", () => {
    expect(usableRecordingUrl("/api/report-recordings/cmszx8v22000e4od4mofyrbk3_2026-10-07_c78b90237f4ef778.webm")).toBe("");
    expect(usableRecordingUrl(null)).toBe("");
    expect(usableRecordingUrl("  ")).toBe("");
  });
});

describe("computeIsLate (display uses the current rule, not the stored flag)", () => {
  // Report dated Oct 7 is stored as UTC midnight; submitted 6:43 PM IST the same day.
  const date = new Date("2026-10-07T00:00:00.000Z");

  it("a 6:43 PM same-day submit is NOT late under the 6 AM next-day rule", () => {
    expect(computeIsLate(date, new Date("2026-10-07T13:13:00.000Z"))).toBe(false);
  });

  it("a submit after 6 AM the next day IS late", () => {
    expect(computeIsLate(date, new Date("2026-10-08T00:31:00.000Z"))).toBe(true);
  });

  it("is never late when not submitted", () => {
    expect(computeIsLate(date, null)).toBe(false);
  });
});
