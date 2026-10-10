// Effort-log dates must follow Indian Standard Time no matter which time zone the server runs in.
// The deployed server runs in UTC; a log added for "10 Oct, 8:00 PM" was showing on 11 Oct.
process.env.TZ = "UTC";

import { describe, it, expect } from "vitest";
import { parseDateAndTimeToDate, toISTDateString } from "@/features/projects/utils/time-helpers";

describe("parseDateAndTimeToDate on a UTC server", () => {
  it("keeps an evening log on the date that was picked (DD/MM/YYYY from the Add dialog)", () => {
    const d = parseDateAndTimeToDate("10/10/2026", "8:00 PM");
    expect(toISTDateString(d)).toBe("2026-10-10");
    expect(d.toISOString()).toBe("2026-10-10T14:30:00.000Z"); // 8:00 PM IST
  });

  it("handles YYYY-MM-DD dates and late-night times", () => {
    expect(toISTDateString(parseDateAndTimeToDate("2026-10-10", "11:30 PM"))).toBe("2026-10-10");
    expect(toISTDateString(parseDateAndTimeToDate("2026-10-10", "12:15 AM"))).toBe("2026-10-10");
  });

  it("a date with no time stays on that IST day", () => {
    expect(toISTDateString(parseDateAndTimeToDate("10/10/2026"))).toBe("2026-10-10");
    expect(toISTDateString(parseDateAndTimeToDate("2026-10-10"))).toBe("2026-10-10");
  });

  it("a Date plus a time keeps that Date's IST day (timer stop with edited times)", () => {
    const startedAt = new Date("2026-10-10T15:00:00.000Z"); // 8:30 PM IST on the 10th
    const d = parseDateAndTimeToDate(startedAt, "9:00 PM");
    expect(d.toISOString()).toBe("2026-10-10T15:30:00.000Z");
  });

  it("a Date with no time is returned unchanged", () => {
    const at = new Date("2026-10-10T15:00:00.000Z");
    expect(parseDateAndTimeToDate(at).getTime()).toBe(at.getTime());
  });
});
