import { describe, expect, it } from "vitest";
import { joinIndustries, parseIndustries } from "@/features/projects/data/industries";

describe("parseIndustries", () => {
  it("reads a single (older) value as one industry", () => {
    expect(parseIndustries("Healthcare")).toEqual(["Healthcare"]);
  });

  it("splits a comma-separated list, trimming and dropping empties and duplicates", () => {
    expect(parseIndustries(" Healthcare ,Skin Care,, healthcare ")).toEqual(["Healthcare", "Skin Care"]);
  });

  it("returns an empty list for nothing", () => {
    expect(parseIndustries("")).toEqual([]);
    expect(parseIndustries(null)).toEqual([]);
    expect(parseIndustries(undefined)).toEqual([]);
  });
});

describe("joinIndustries", () => {
  it("joins with a comma and space", () => {
    expect(joinIndustries(["Healthcare", "Skin Care"])).toBe("Healthcare, Skin Care");
  });

  it("removes commas inside a typed name so it stays one industry", () => {
    expect(joinIndustries(["Food, Beverage"])).toBe("Food  Beverage");
  });

  it("round-trips through parseIndustries", () => {
    const list = ["Banking & Finance", "Real Estate"];
    expect(parseIndustries(joinIndustries(list))).toEqual(list);
  });
});
