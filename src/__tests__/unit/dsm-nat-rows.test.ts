import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureNat: vi.fn(),
  ensureUnassigned: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/features/dsm/actions/create-project-items", () => ({
  ensureNatTaskForTimerAction: mocks.ensureNat,
  ensureUnassignedTaskForTimerAction: mocks.ensureUnassigned,
}));
vi.mock("@/lib/db", () => ({ db: { standupTask: { update: mocks.update } } }));

import { linkNoProjectRowsToUnassigned, linkProjectOnlyRowsToNat } from "@/features/dsm/manager/nat-rows";
import { isUnassignedProject, UNASSIGNED_PROJECT_CODE } from "@/features/dsm/utils";

describe("isUnassignedProject", () => {
  it("matches only the holding project's code", () => {
    expect(isUnassignedProject({ code: UNASSIGNED_PROJECT_CODE })).toBe(true);
    expect(isUnassignedProject({ code: "TTG" })).toBe(false);
    expect(isUnassignedProject({ code: null })).toBe(false);
    expect(isUnassignedProject(null)).toBe(false);
    expect(isUnassignedProject(undefined)).toBe(false);
  });
});

describe("linkNoProjectRowsToUnassigned", () => {
  beforeEach(() => {
    mocks.ensureUnassigned.mockReset();
    mocks.update.mockReset();
  });

  it("creates the member's Unassigned Work task and links the row to its project and task", async () => {
    mocks.ensureUnassigned.mockResolvedValue({
      success: true,
      task: { id: "pt-9" },
      taskListCode: "P1",
      created: true,
      project: { id: "unassigned-1" },
    });

    const res = await linkNoProjectRowsToUnassigned([{ id: "row-1", text: "Call vendor" }], "member-1");

    expect(mocks.ensureUnassigned).toHaveBeenCalledWith("Call vendor", "member-1");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "row-1" },
      data: { projectId: "unassigned-1", projectTaskId: "pt-9" },
    });
    expect(res).toEqual({ linked: 1, failed: 0 });
  });

  it("leaves a row unlinked when the task can't be created", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.ensureUnassigned.mockResolvedValue({ success: false, error: "nope" });

    const res = await linkNoProjectRowsToUnassigned([{ id: "row-1", text: "A" }], "member-1");

    expect(mocks.update).not.toHaveBeenCalled();
    expect(res).toEqual({ linked: 0, failed: 1 });
  });
});

describe("linkProjectOnlyRowsToNat", () => {
  beforeEach(() => {
    mocks.ensureNat.mockReset();
    mocks.update.mockReset();
  });

  it("creates the NAT task for the member (not the manager) and links the DSM row", async () => {
    mocks.ensureNat.mockResolvedValue({ success: true, task: { id: "pt-1" }, taskListCode: "7.9", created: true });

    const res = await linkProjectOnlyRowsToNat([{ id: "row-1", text: "Fix header", projectId: "proj-1" }], "member-1");

    expect(mocks.ensureNat).toHaveBeenCalledWith("proj-1", "Fix header", "member-1");
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "row-1" }, data: { projectTaskId: "pt-1" } });
    expect(res).toEqual({ linked: 1, failed: 0 });
  });

  it("leaves a row on just its project when its project has no NAT list", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.ensureNat
      .mockResolvedValueOnce({ success: false, error: "no NAT list" })
      .mockResolvedValueOnce({ success: true, task: { id: "pt-2" }, taskListCode: "7.9", created: false });

    const res = await linkProjectOnlyRowsToNat(
      [
        { id: "row-1", text: "A", projectId: "no-nat" },
        { id: "row-2", text: "B", projectId: "proj-2" },
      ],
      "member-1"
    );

    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "row-2" }, data: { projectTaskId: "pt-2" } });
    expect(res).toEqual({ linked: 1, failed: 1 });
  });
});
