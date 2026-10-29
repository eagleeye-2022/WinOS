import { describe, expect, it } from "vitest";
import { compareTimeLogsDayNewestTimeEarliest } from "@/features/projects/utils/time-helpers";

describe("compareTimeLogsDayNewestTimeEarliest", () => {
  it("puts the newest day first and each day's logs in the order they happened", () => {
    const logs = [
      { id: "a", date: "2026-10-27", timePeriod: "11:00 AM – 1:00 PM" },
      { id: "b", date: "2026-10-28", timePeriod: "2:00 PM – 5:15 PM" },
      { id: "c", date: "2026-10-28", timePeriod: "9:05 AM – 10:00 AM" },
      { id: "d", date: "2026-10-27", timePeriod: "9:00 AM – 9:45 AM" },
      { id: "e", date: "2026-10-28", timePeriod: "10:10 AM – 12:30 PM" },
    ];
    expect([...logs].sort(compareTimeLogsDayNewestTimeEarliest).map((l) => l.id)).toEqual(["c", "e", "b", "d", "a"]);
  });

  it("handles DD/MM/YYYY dates and puts logs without a time last in their day", () => {
    const logs = [
      { id: "noTime", date: "28/10/2026", timePeriod: "" },
      { id: "late", date: "28/10/2026", timePeriod: "4:00 PM – 5:00 PM" },
      { id: "older", date: "01/10/2026", timePeriod: "8:00 AM – 9:00 AM" },
      { id: "early", date: "28/10/2026", timePeriod: "8:30 AM – 9:00 AM" },
    ];
    expect([...logs].sort(compareTimeLogsDayNewestTimeEarliest).map((l) => l.id)).toEqual(["early", "late", "noTime", "older"]);
  });
});
