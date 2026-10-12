import { describe, expect, it } from "vitest";
import { MAX_LOG_DURATION_ERROR, SAME_DAY_LOG_ERROR, sameDayLogError } from "@/features/projects/utils/time-helpers";

describe("sameDayLogError", () => {
  it("accepts a timer stopped in the same clock minute it started (saved as 1 minute)", () => {
    expect(sameDayLogError(1, "10:05 AM – 10:05 AM")).toBeNull();
  });

  it("accepts normal same-day ranges", () => {
    expect(sameDayLogError(30, "10:05 AM – 10:35 AM")).toBeNull();
    expect(sameDayLogError(720, "6:00 AM - 6:00 PM")).toBeNull();
    expect(sameDayLogError(45, "")).toBeNull();
  });

  it("still rejects ranges that run past midnight", () => {
    expect(sameDayLogError(180, "10:00 PM – 1:00 AM")).toBe(SAME_DAY_LOG_ERROR);
  });

  it("still rejects an equal start/end on a longer log", () => {
    expect(sameDayLogError(120, "10:00 AM – 10:00 AM")).toBe(SAME_DAY_LOG_ERROR);
  });

  it("still rejects logs longer than a day", () => {
    expect(sameDayLogError(24 * 60, "")).toBe(MAX_LOG_DURATION_ERROR);
  });
});
