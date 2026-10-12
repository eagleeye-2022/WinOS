import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureNat: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/features/dsm/actions/create-project-items", () => ({
  ensureNatTaskForTimerAction: mocks.ensureNat,
}));
vi.mock("@/lib/db", () => ({ db: { standupTask: { update: mocks.update } } }));

import { linkProjectOnlyRowsToNat } from "@/features/dsm/manager/nat-rows";

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
