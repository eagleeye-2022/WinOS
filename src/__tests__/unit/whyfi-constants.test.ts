import { describe, expect, it } from "vitest";
import {
  effortProjectLabel,
  formatLearningLine,
  parseLearningLineCode,
  stripLearningLineCode,
} from "@/features/whyfi/constants";

describe("Whyfi learning line links", () => {
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

describe("effortProjectLabel", () => {
  it("labels learning lists in effort views and leaves projects alone", () => {
    expect(effortProjectLabel("Dhruv - Jr SDE", "LEARNING")).toBe("Whyfi Learning · Dhruv - Jr SDE");
    expect(effortProjectLabel("MalavGram", "CLIENT_DELIVERY")).toBe("MalavGram");
    expect(effortProjectLabel("MalavGram", null)).toBe("MalavGram");
  });
});
