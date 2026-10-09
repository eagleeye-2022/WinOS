import { describe, expect, it } from "vitest";
import {
  canEditProjectCard,
  canShareToProject,
  canViewProjectCards,
  isPrivilegedRole,
  parseIdList,
} from "@/features/notes/project-notes-utils";

describe("isPrivilegedRole", () => {
  it("treats the MANAGER role as privileged (same flag the iNotes UI uses)", () => {
    expect(isPrivilegedRole("MANAGER")).toBe(true);
    expect(isPrivilegedRole("manager")).toBe(true);
  });

  it("does not treat team members or unknown roles as privileged", () => {
    expect(isPrivilegedRole("TEAM_MEMBER")).toBe(false);
    expect(isPrivilegedRole("ADMIN")).toBe(false);
    expect(isPrivilegedRole(null)).toBe(false);
    expect(isPrivilegedRole(undefined)).toBe(false);
  });
});

describe("view / share / edit rules", () => {
  it("managers and project members can view; nobody else", () => {
    expect(canViewProjectCards({ isPrivileged: true, isProjectMember: false })).toBe(true);
    expect(canViewProjectCards({ isPrivileged: false, isProjectMember: true })).toBe(true);
    expect(canViewProjectCards({ isPrivileged: false, isProjectMember: false })).toBe(false);
  });

  it("authors can share to their own projects; managers to any", () => {
    expect(canShareToProject({ isPrivileged: false, isProjectMember: true })).toBe(true);
    expect(canShareToProject({ isPrivileged: true, isProjectMember: false })).toBe(true);
    expect(canShareToProject({ isPrivileged: false, isProjectMember: false })).toBe(false);
  });

  it("only managers and the card's author can edit", () => {
    expect(canEditProjectCard({ isPrivileged: true, isAuthor: false })).toBe(true);
    expect(canEditProjectCard({ isPrivileged: false, isAuthor: true })).toBe(true);
    expect(canEditProjectCard({ isPrivileged: false, isAuthor: false })).toBe(false);
  });
});

describe("parseIdList", () => {
  it("trims, drops blanks and duplicates", () => {
    expect(parseIdList(" p1, ,p2,p1 ")).toEqual(["p1", "p2"]);
    expect(parseIdList("")).toEqual([]);
    expect(parseIdList(null)).toEqual([]);
  });
});
