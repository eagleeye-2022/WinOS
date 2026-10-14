import { describe, expect, it } from "vitest";
import { projectPillName, shortProjectName } from "@/features/projects/utils/project-name";

describe("projectPillName (DSM project column)", () => {
  it("shows the part before the first colon", () => {
    expect(projectPillName("MGM : MalavGram")).toBe("MGM");
    expect(projectPillName("ALS : Ayurveda Labs")).toBe("ALS");
  });

  it("without a colon, shows the first 5 characters and a dot", () => {
    expect(projectPillName("Kosmetics")).toBe("Kosme.");
    expect(projectPillName("Pamas")).toBe("Pamas");
    expect(projectPillName("7Dots")).toBe("7Dots");
  });

  it("with nothing before the colon, falls back to the 5-character rule", () => {
    expect(projectPillName(": Untitled")).toBe(": Unt.");
  });
});

describe("shortProjectName", () => {
  it("shows the part before the first colon", () => {
    expect(shortProjectName("MGM : MalavGram")).toBe("MGM");
    expect(shortProjectName("SBI: Scribs")).toBe("SBI");
    expect(shortProjectName("A: B: C")).toBe("A");
  });

  it("shows the full name when there is no colon", () => {
    expect(shortProjectName("NES HRMS")).toBe("NES HRMS");
    expect(shortProjectName("  WinOS ")).toBe("WinOS");
  });

  it("falls back to the full name when nothing is before the colon", () => {
    expect(shortProjectName(": Untitled")).toBe(": Untitled");
    expect(shortProjectName("")).toBe("");
    expect(shortProjectName(null)).toBe("");
  });
});
