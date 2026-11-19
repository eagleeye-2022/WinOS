import { describe, expect, it } from "vitest";
import { canEditProfileField, isProfileField, parseProfileFieldValue } from "@/features/users/profile-fields";

const ME = "user-1";
const OTHER = "user-2";

describe("canEditProfileField", () => {
  it("lets members edit their own personal and contact details", () => {
    const me = { id: ME, isManager: false };
    expect(canEditProfileField("dateOfBirth", me, ME)).toBe(true);
    expect(canEditProfileField("personalMobile", me, ME)).toBe(true);
    expect(canEditProfileField("parentGuardianRelationship", me, ME)).toBe(true);
  });

  it("keeps work details, role, email, hierarchy, IDs and bank info manager-only, even on your own profile", () => {
    const me = { id: ME, isManager: false };
    for (const f of [
      "name",
      "employeeId",
      "email",
      "role",
      "title",
      "department",
      "dateOfJoining",
      "reportingToId",
      "secondaryReportingToId",
      "aadharNumber",
      "bankAccountNumber",
      "ifscCode",
    ] as const) {
      expect(canEditProfileField(f, me, ME)).toBe(false);
    }
  });

  it("never lets a non-manager edit someone else", () => {
    expect(canEditProfileField("permanentAddress", { id: ME, isManager: false }, OTHER)).toBe(false);
  });

  it("lets managers edit every field on anyone", () => {
    const mgr = { id: ME, isManager: true };
    expect(canEditProfileField("bankAccountNumber", mgr, OTHER)).toBe(true);
    expect(canEditProfileField("gender", mgr, OTHER)).toBe(true);
  });
});

describe("isProfileField", () => {
  it("rejects fields that aren't inline-editable (password, active flag, profile role…)", () => {
    expect(isProfileField("password")).toBe(false);
    expect(isProfileField("isActive")).toBe(false);
    expect(isProfileField("profileRole")).toBe(false);
    expect(isProfileField("toString")).toBe(false);
    expect(isProfileField("gender")).toBe(true);
    expect(isProfileField("role")).toBe(true);
  });
});

describe("parseProfileFieldValue", () => {
  it("refuses to clear a required field", () => {
    expect(parseProfileFieldValue("parentGuardianName", "  ")).toEqual({ error: "Parent/Guardian Name is required." });
  });

  it("clears an optional field to null", () => {
    expect(parseProfileFieldValue("permanentAddress", "")).toEqual({ value: null });
  });

  it("treats a bare +91 as an empty phone number", () => {
    expect(parseProfileFieldValue("workMobile", "+91")).toEqual({ value: null });
    expect(parseProfileFieldValue("personalMobile", "+91 ")).toEqual({ error: "Permanent Mobile Number is required." });
    expect(parseProfileFieldValue("personalMobile", "+91 9876543210")).toEqual({ value: "+91 9876543210" });
  });

  it("only accepts listed options for dropdowns", () => {
    expect(parseProfileFieldValue("gender", "Female")).toEqual({ value: "Female" });
    expect("error" in parseProfileFieldValue("gender", "Robot")).toBe(true);
    expect("error" in parseProfileFieldValue("department", "Nowhere")).toBe(true);
  });

  it("accepts only real role values and requires one", () => {
    expect(parseProfileFieldValue("role", "MANAGER")).toEqual({ value: "MANAGER" });
    expect("error" in parseProfileFieldValue("role", "ADMIN")).toBe(true);
    expect("error" in parseProfileFieldValue("role", "")).toBe(true);
  });

  it("lets the primary reporting manager be cleared (Top of Hierarchy)", () => {
    expect(parseProfileFieldValue("reportingToId", "")).toEqual({ value: null });
    expect(parseProfileFieldValue("reportingToId", "cm123")).toEqual({ value: "cm123" });
  });

  it("requires a valid work email", () => {
    expect("error" in parseProfileFieldValue("email", "")).toBe(true);
    expect(parseProfileFieldValue("email", "A.B@EagleEyeDigital.io")).toEqual({ value: "a.b@eagleeyedigital.io" });
  });

  it("validates email addresses and lower-cases them", () => {
    expect(parseProfileFieldValue("personalEmail", "Me@Example.com")).toEqual({ value: "me@example.com" });
    expect("error" in parseProfileFieldValue("personalEmail", "not-an-email")).toBe(true);
  });

  it("parses dates and refuses a date of birth in the future", () => {
    const today = new Date("2026-11-18T10:00:00.000Z");
    expect(parseProfileFieldValue("dateOfJoining", "2025-04-01", today)).toEqual({ value: new Date("2025-04-01T00:00:00.000Z") });
    expect(parseProfileFieldValue("dateOfBirth", "2026-11-19", today)).toEqual({
      error: "Date of Birth cannot be greater than the current date.",
    });
    expect("error" in parseProfileFieldValue("dateOfBirth", "18/11/2000", today)).toBe(true);
  });
});
