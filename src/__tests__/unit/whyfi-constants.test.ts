import { describe, expect, it } from "vitest";
import {
  nextWhyfiTaskCode,
  effortProjectLabel,
  normalizeDueDate,
  formatLearningLine,
  parseLearningLineCode,
  stripLearningLineCode,
} from "@/features/whyfi/constants";

describe("WhyFi learning line links", () => {
  it("reads the card code from a linked DSM learning line", () => {
    expect(parseLearningLineCode("[WL-1-T3] Learn React hooks")).toBe("WL-1-T3");
    expect(parseLearningLineCode("  [WL-12-T40]Docs")).toBe("WL-12-T40");
  });

  it("ignores lines that aren't linked to a learning card", () => {
    expect(parseLearningLineCode("Learn React hooks")).toBeNull();
    expect(parseLearningLineCode("[EEDP-4-T3] Project task")).toBeNull();
    expect(parseLearningLineCode("Read about [WL-1-T3] later")).toBeNull();
  });

  it("strips the link prefix and keeps the text", () => {
    expect(stripLearningLineCode("[WL-1-T3] Learn React hooks")).toBe("Learn React hooks");
    expect(stripLearningLineCode("Learn React hooks")).toBe("Learn React hooks");
  });

  it("formats a link, replacing any existing one", () => {
    expect(formatLearningLine("WL-2-T1", "Learn hooks")).toBe("[WL-2-T1] Learn hooks");
    expect(formatLearningLine("WL-2-T1", "[WL-1-T3] Learn hooks")).toBe("[WL-2-T1] Learn hooks");
    expect(formatLearningLine("WL-2-T1", "")).toBe("[WL-2-T1]");
  });
});

describe("WhyFi task IDs (WIFI<n>)", () => {
  it("starts at WIFI1 and continues past the highest WIFI number, ignoring old WL codes", () => {
    expect(nextWhyfiTaskCode([])).toBe("WIFI1");
    expect(nextWhyfiTaskCode(["WL-1-T40", "WL-2-T3"])).toBe("WIFI1");
    expect(nextWhyfiTaskCode(["WIFI3", "WIFI11", "WL-1-T99", "WIFI-X"])).toBe("WIFI12");
  });

  it("links DSM learning lines to WIFI cards as well as old WL cards", () => {
    expect(parseLearningLineCode("[WIFI12] Learn hooks")).toBe("WIFI12");
    expect(stripLearningLineCode("[WIFI12] Learn hooks")).toBe("Learn hooks");
    expect(formatLearningLine("WIFI12", "[WL-1-T3] Learn hooks")).toBe("[WIFI12] Learn hooks");
    expect(parseLearningLineCode("[WIFI12.1] Learn hooks")).toBeNull();
  });
});

describe("normalizeDueDate", () => {
  it("reads WhyFi ISO dates and imported DD/MM/YYYY dates", () => {
    expect(normalizeDueDate("2026-10-12")).toBe("2026-10-12");
    expect(normalizeDueDate("23/08/2025")).toBe("2025-08-23");
    expect(normalizeDueDate("3/8/2025")).toBe("2025-08-03");
  });

  it("returns empty for no date or an invalid one", () => {
    expect(normalizeDueDate("--")).toBe("");
    expect(normalizeDueDate("")).toBe("");
    expect(normalizeDueDate(null)).toBe("");
    expect(normalizeDueDate("31/02/2026")).toBe("");
    expect(normalizeDueDate("next week")).toBe("");
  });
});

describe("effortProjectLabel", () => {
  it("labels learning lists in effort views and leaves projects alone", () => {
    expect(effortProjectLabel("Dhruv - Jr SDE", "LEARNING")).toBe("WhyFi School");
    expect(effortProjectLabel("Vanshika UI/UX", "LEARNING")).toBe("WhyFi School");
    expect(effortProjectLabel("MalavGram", "CLIENT_DELIVERY")).toBe("MalavGram");
    expect(effortProjectLabel("MalavGram", null)).toBe("MalavGram");
  });
});
