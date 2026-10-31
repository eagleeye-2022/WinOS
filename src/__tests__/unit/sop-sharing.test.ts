import { describe, expect, it } from "vitest";
import { isSopVisibleTo } from "@/features/sop-checklists/utils";
import type { SopShare } from "@/features/sop-checklists/types";

const sop = { id: "s1", department: "Marketing", list: "SEO", createdById: "creator" };
const viewer = { id: "u1", department: "HR" };
const share = (over: Partial<SopShare>): SopShare => ({
  templateId: null,
  department: null,
  listName: null,
  targetUserId: null,
  targetDepartment: null,
  ...over,
});

describe("isSopVisibleTo", () => {
  it("hides an SOP that isn't shared", () => {
    expect(isSopVisibleTo(sop, viewer, [])).toBe(false);
  });

  it("always shows an SOP to its creator", () => {
    expect(isSopVisibleTo(sop, { id: "creator" }, [])).toBe(true);
  });

  it("shows a card shared with the person or their department", () => {
    expect(isSopVisibleTo(sop, viewer, [share({ templateId: "s1", targetUserId: "u1" })])).toBe(true);
    expect(isSopVisibleTo(sop, viewer, [share({ templateId: "s1", targetDepartment: "HR" })])).toBe(true);
  });

  it("shows every SOP of a list shared with them", () => {
    const shares = [share({ department: "Marketing", listName: "SEO", targetUserId: "u1" })];
    expect(isSopVisibleTo(sop, viewer, shares)).toBe(true);
  });

  it("doesn't confuse the same list name in another department", () => {
    const shares = [share({ department: "Sales", listName: "SEO", targetUserId: "u1" })];
    expect(isSopVisibleTo(sop, viewer, shares)).toBe(false);
  });

  it("doesn't show what's shared with someone else, another SOP or another department", () => {
    expect(isSopVisibleTo(sop, viewer, [share({ templateId: "s1", targetUserId: "other" })])).toBe(false);
    expect(isSopVisibleTo(sop, viewer, [share({ templateId: "s2", targetUserId: "u1" })])).toBe(false);
    expect(isSopVisibleTo(sop, viewer, [share({ templateId: "s1", targetDepartment: "Sales" })])).toBe(false);
  });

  it("a viewer with no department doesn't match a department share", () => {
    expect(isSopVisibleTo(sop, { id: "u1", department: null }, [share({ templateId: "s1", targetDepartment: "HR" })])).toBe(false);
  });
});
