import { beforeEach, describe, expect, it, vi } from "vitest";

// Setu server actions with auth / db mocked: access rules, code assignment, renumbering,
// proposal publishing and meeting state rules.

const mocks = vi.hoisted(() => {
  const model = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  });
  const db = {
    user: model(),
    crmDeal: model(),
    crmDealWon: model(),
    crmDealLost: model(),
    crmNote: model(),
    crmNegotiationRequest: model(),
    crmTimeLog: model(),
    crmActiveTimer: model(),
    crmCall: model(),
    crmMeeting: model(),
    crmMeetingAttendee: model(),
    crmProposal: model(),
    crmFile: model(),
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  };
  return { db, auth: vi.fn(), revalidatePath: vi.fn() };
});

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { createDealAction, moveDealAction } from "@/features/setu/actions/deal-actions";
import { deleteRequestAction, startTimerAction } from "@/features/setu/actions/activity-actions";
import { cancelMeetingAction, deleteMeetingAction } from "@/features/setu/actions/meeting-actions";
import { publishProposalAction } from "@/features/setu/actions/proposal-actions";

const d = mocks.db;
const ME = { id: "u1", name: "Vamshi", email: "v@eagleeyedigital.io", title: "Sales Lead", isActive: true, profileRole: "EMPLOYEE" };

/** Minimal deal row as returned with dealInclude. */
const dealRow = (over: Record<string, unknown> = {}) => ({
  id: "d1",
  leadCode: "LD-2026-0001",
  dealCode: null,
  title: "",
  company: "ABC",
  contactName: "Rahul",
  contactRole: "Decision Maker",
  phone: "9999999999",
  email: "r@abc.com",
  location: "Pune",
  source: "",
  stage: "LEAD",
  ownerId: "u1",
  value: null,
  proposalVersion: null,
  remark: "",
  dueDate: null,
  closedAt: null,
  createdById: "u1",
  createdAt: new Date("2026-11-01T00:00:00Z"),
  updatedAt: new Date("2026-11-01T00:00:00Z"),
  owner: { id: "u1", name: "Vamshi", email: "v@eagleeyedigital.io", title: null },
  won: null,
  lost: null,
  files: [],
  ...over,
});

const input = { company: "ABC", contactName: "Rahul", contactRole: "", phone: "9999999999", email: "r@abc.com", location: "Pune", source: "", stage: "LEAD" as const, title: "", remark: "" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "u1", email: ME.email } });
  d.user.findFirst.mockResolvedValue(ME);
});

describe("access", () => {
  it("refuses signed-out users and CLIENT logins", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await createDealAction(input)).toMatchObject({ ok: false });
    mocks.auth.mockResolvedValue({ user: { id: "c1" } });
    d.user.findFirst.mockResolvedValue({ ...ME, id: "c1", profileRole: "CLIENT" });
    expect(await createDealAction(input)).toMatchObject({ ok: false });
    expect(d.crmDeal.create).not.toHaveBeenCalled();
  });

  it("refuses deactivated users", async () => {
    d.user.findFirst.mockResolvedValue({ ...ME, isActive: false });
    expect(await createDealAction(input)).toMatchObject({ ok: false });
  });
});

describe("deals", () => {
  it("creates a lead with the next LD code, owned by the signed-in user", async () => {
    d.crmDeal.findFirst.mockResolvedValue({ leadCode: "LD-2026-0041", dealCode: null });
    d.crmDeal.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => dealRow({ ...data }));
    const res = await createDealAction(input);
    expect(res.ok).toBe(true);
    const data = d.crmDeal.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ leadCode: expect.stringMatching(/^LD-\d{4}-0042$/), ownerId: "u1", createdById: "u1", stage: "LEAD" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/setu", "layout");
  });

  it("retries with a fresh code when another request took the number", async () => {
    d.crmDeal.findFirst.mockResolvedValue(null);
    d.crmDeal.create.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" })).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => dealRow({ ...data }));
    expect((await createDealAction(input)).ok).toBe(true);
    expect(d.crmDeal.create).toHaveBeenCalledTimes(2);
  });

  it("validates input on the server", async () => {
    expect(await createDealAction({ ...input, email: "bad" })).toEqual({ ok: false, error: "Enter a valid email." });
  });

  it("assigns a DEAL code the first time a lead reaches Proposal", async () => {
    d.crmDeal.findUnique.mockResolvedValue({ stage: "DISCUSSION", dealCode: null });
    d.crmDeal.findFirst.mockResolvedValue({ leadCode: "x", dealCode: "DEAL-2026-0007" });
    d.crmDeal.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => dealRow({ ...data }));
    const res = await moveDealAction("d1", "PROPOSAL");
    expect(res.ok).toBe(true);
    expect(d.crmDeal.update.mock.calls[0][0].data).toMatchObject({ stage: "PROPOSAL", dealCode: expect.stringMatching(/^DEAL-\d{4}-0008$/), closedAt: null });
  });

  it("stamps closedAt when moved to a closed stage", async () => {
    d.crmDeal.findUnique.mockResolvedValue({ stage: "NEGOTIATION", dealCode: "DEAL-2026-0001" });
    d.crmDeal.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => dealRow({ ...data }));
    await moveDealAction("d1", "CLOSED_LOST");
    expect(d.crmDeal.update.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date);
    expect(d.crmDeal.update.mock.calls[0][0].data.dealCode).toBeUndefined();
  });
});

describe("requests and timers", () => {
  it("renumbers the remaining levels after a delete", async () => {
    d.crmNegotiationRequest.findUnique.mockResolvedValue({ dealId: "d1" });
    d.crmNegotiationRequest.findMany
      .mockResolvedValueOnce([
        { id: "r2", level: 2 },
        { id: "r3", level: 3 },
      ])
      .mockResolvedValueOnce([]);
    await deleteRequestAction("r1");
    expect(d.crmNegotiationRequest.update.mock.calls.map((c) => [c[0].where.id, c[0].data.level])).toEqual([
      ["r2", 1],
      ["r3", 2],
    ]);
  });

  it("allows one running timer per user", async () => {
    d.crmDeal.findUnique.mockResolvedValue({ id: "d1" });
    d.crmActiveTimer.findUnique.mockResolvedValue({ userId: "u1", dealId: "d2" });
    expect(await startTimerAction("d1")).toMatchObject({ ok: false });
    expect(d.crmActiveTimer.create).not.toHaveBeenCalled();
  });
});

describe("proposals", () => {
  it("publishing supersedes the active version and sets the deal value", async () => {
    d.crmProposal.findUnique.mockResolvedValue({ status: "DRAFT", dealId: "d1", version: 4 });
    d.crmProposal.findMany.mockResolvedValue([]);
    d.crmDeal.findUnique.mockResolvedValue(dealRow({ stage: "NEGOTIATION" }));
    const res = await publishProposalAction("p4", { title: "V4", value: 425000, reason: "5% off" }, null);
    expect(res.ok).toBe(true);
    expect(d.crmProposal.updateMany).toHaveBeenCalledWith({ where: { dealId: "d1", status: "ACTIVE" }, data: { status: "SUPERSEDED" } });
    expect(d.crmProposal.update).toHaveBeenCalledWith({ where: { id: "p4" }, data: { status: "ACTIVE" } });
    expect(d.crmDeal.update).toHaveBeenCalledWith({ where: { id: "d1" }, data: { value: 425000, proposalVersion: 4 } });
  });

  it("refuses to publish something that isn't a draft", async () => {
    d.crmProposal.findUnique.mockResolvedValue({ status: "ACTIVE", dealId: "d1", version: 3 });
    expect(await publishProposalAction("p3", { title: "V3", value: 1, reason: "" }, null)).toMatchObject({ ok: false });
    expect(d.crmProposal.updateMany).not.toHaveBeenCalled();
  });

  it("rejects attachments that didn't come from the upload route", async () => {
    const res = await publishProposalAction("p4", { title: "V4", value: 1, reason: "" }, { id: "upload-1", name: "a.pdf", size: 1, url: "https://evil.example/a.pdf" });
    expect(res).toMatchObject({ ok: false });
  });
});

describe("meetings", () => {
  it("only cancels scheduled meetings", async () => {
    d.crmMeeting.findUnique.mockResolvedValue({ status: "COMPLETED" });
    expect(await cancelMeetingAction("m1")).toMatchObject({ ok: false });
    expect(d.crmMeeting.update).not.toHaveBeenCalled();
  });

  it("only deletes drafts", async () => {
    d.crmMeeting.findUnique.mockResolvedValue({ status: "UPCOMING" });
    expect(await deleteMeetingAction("m1")).toMatchObject({ ok: false });
    expect(d.crmMeeting.deleteMany).not.toHaveBeenCalled();
  });
});
