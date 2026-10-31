import { describe, expect, it } from "vitest";
import { sopDepartmentFor, sopDepartmentOf } from "@/features/sop-checklists/utils";
import { SOP_DEPARTMENTS } from "@/features/sop-checklists/types";
import { DEPARTMENTS } from "@/features/users/constants";

describe("sopDepartmentOf", () => {
  it("uses the company's department list", () => {
    expect(SOP_DEPARTMENTS).toBe(DEPARTMENTS);
  });

  it("leaves departments as they are", () => {
    for (const d of SOP_DEPARTMENTS) expect(sopDepartmentOf(d, "Anything")).toBe(d);
  });

  it("maps the old categories to departments", () => {
    expect(sopDepartmentOf("SEO", "Blog Structure SOP")).toBe("Marketing");
    expect(sopDepartmentOf("Design", "BNI Social Media")).toBe("Operation");
    expect(sopDepartmentOf("Development", "Website Development SOP")).toBe("Operation");
    expect(sopDepartmentOf("Client Delivery", "KT Session SOP")).toBe("Operation");
    expect(sopDepartmentOf("QA", "UAT Feedback Checklist")).toBe("Operation");
    expect(sopDepartmentOf("General", "Daily Tasks")).toBe("Operation");
  });

  it("maps team names that aren't departments", () => {
    expect(sopDepartmentOf("Creative", "BNI Social Media")).toBe("Operation");
    expect(sopDepartmentOf("Tech", "Website Development SOP")).toBe("Operation");
    expect(sopDepartmentOf("EED Core", "Anything")).toBe("Management");
  });

  it("files specific old SOPs under their own department", () => {
    expect(sopDepartmentOf("Client Delivery", "Credential Checklist")).toBe("HR");
    expect(sopDepartmentOf("General", "Things to Do Before Leaving Office")).toBe("HR");
    expect(sopDepartmentOf("General", "Sales SOP: Proposal or Estimate Review")).toBe("Sales");
    expect(sopDepartmentOf("General", "LNP Saturday SOP: Monthly Planning Session")).toBe("Management");
  });

  it("a moved SOP stays where it was moved, even if its name has a default", () => {
    expect(sopDepartmentOf("Marketing", "Credential Checklist")).toBe("Marketing");
  });

  it("defaults unknown and empty categories", () => {
    expect(sopDepartmentOf("Hosting", "Anything")).toBe("Operation");
    expect(sopDepartmentOf("", "Anything")).toBe("Operation");
    expect(sopDepartmentOf(null)).toBe("Operation");
  });

  it("sopDepartmentFor prefers the saved department, keeping the list separate", () => {
    expect(sopDepartmentFor({ department: "Sales", category: "SEO", name: "X" })).toBe("Sales");
    expect(sopDepartmentFor({ department: null, category: "SEO", name: "X" })).toBe("Marketing");
  });
});
