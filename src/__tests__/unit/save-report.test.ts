import { describe, it, expect, vi, beforeEach } from "vitest";

// saveDsr (the end-of-day report action) with auth/db/next mocked — verifies the recording link
// requirement, late flag, time snapshot and the best-effort Cliq post.

const mocks = vi.hoisted(() => {
  const db = {
    user: { findUnique: vi.fn() },
    standupEntry: { findUnique: vi.fn() },
    standupTask: { findMany: vi.fn(), update: vi.fn() },
    dsrEntry: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    dsrPlannedTask: { deleteMany: vi.fn(), createMany: vi.fn() },
    dsrAdditionalWork: { deleteMany: vi.fn(), createMany: vi.fn() },
    dsrResolvedBlocker: { deleteMany: vi.fn(), createMany: vi.fn() },
    dsrFollowUpDone: { deleteMany: vi.fn(), createMany: vi.fn() },
    dsrLearningItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    dsrTimelineEvent: { findFirst: vi.fn(), create: vi.fn() },
  };
  return {
    db,
    auth: vi.fn(),
    redirect: vi.fn(),
    getDayEffort: vi.fn(),
    postToCliq: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/dsm/queries", () => ({ getDayEffort: mocks.getDayEffort }));
vi.mock("@/lib/zoho-cliq", () => ({
  postToCliq: mocks.postToCliq,
  getAppBaseUrl: () => "https://winos.test",
}));

import { saveDsr } from "@/features/dsr/actions/save-dsr";

function form(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const values: Record<string, string> = {
    action: "submit",
    date: "2026-10-06",
    plannedTasksJson: JSON.stringify([
      { text: "Fix login", priority: "P1", completed: true },
      { text: "Write tests", priority: null, completed: false },
    ]),
    additionalWorksJson: "[]",
    resolvedBlockersJson: "[]",
    followUpsDoneJson: "[]",
    learningItemsJson: "[]",
    resultOfDay: "Login fixed",
    dayFeedback: "Good day",
    suggestions: "",
    recordingUrl: "https://cliq.zoho.in/chats/abc",
    ...overrides,
  };
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.REPORT_CUTOFF_HHMM;
  delete process.env.REPORT_RECORDING_ALLOWED_HOSTS;
  mocks.db.standupEntry.findUnique.mockResolvedValue({ status: "REVIEWED", blockers: [], supportNeeds: [] });
  mocks.db.standupTask.findMany.mockResolvedValue([]);
  mocks.db.dsrEntry.findUnique.mockResolvedValue(null);
  mocks.db.dsrEntry.upsert.mockResolvedValue({ id: "e1" });
  mocks.db.dsrTimelineEvent.findFirst.mockResolvedValue(null);
  mocks.getDayEffort.mockResolvedValue([
    { taskId: "t1", minutes: 120, task: null },
    { taskId: "t2", minutes: 45, task: null },
  ]);
  mocks.postToCliq.mockResolvedValue({ ok: true });
  mocks.auth.mockResolvedValue({ user: { id: "u1u1u1u1u1", role: "TEAM_MEMBER", name: "Asha" } });
  mocks.db.user.findUnique.mockResolvedValue({ id: "u1u1u1u1u1", name: "Asha", email: "asha@eagleeyedigital.io" });
});

describe("saveDsr: end-of-day report", () => {
  it("rejects a submit without a recording link and writes nothing", async () => {
    const res = await saveDsr({}, form({ recordingUrl: "" }));

    expect(res.errors?.recordingUrl?.[0]).toMatch(/recording/i);
    expect(mocks.db.dsrEntry.upsert).not.toHaveBeenCalled();
    expect(mocks.postToCliq).not.toHaveBeenCalled();
  });

  it("rejects a recording link outside the allow-list", async () => {
    const res = await saveDsr({}, form({ recordingUrl: "https://example.com/video" }));

    expect(res.errors?.recordingUrl).toBeDefined();
    expect(mocks.db.dsrEntry.upsert).not.toHaveBeenCalled();
  });

  it("allows a draft without a recording link", async () => {
    const res = await saveDsr({}, form({ action: "draft", recordingUrl: "" }));

    expect(res).toEqual({ message: "saved" });
    expect(mocks.db.dsrEntry.upsert).toHaveBeenCalled();
    expect(mocks.postToCliq).not.toHaveBeenCalled();
  });

  it("saves the link, feedback and time snapshot, then posts to Cliq", async () => {
    await saveDsr({}, form());

    const { create } = mocks.db.dsrEntry.upsert.mock.calls[0][0];
    expect(create).toMatchObject({
      status: "SUBMITTED",
      recordingUrl: "https://cliq.zoho.in/chats/abc",
      dayFeedback: "Good day",
      suggestions: null,
      totalLoggedMinutes: 165,
      completedTaskCount: 1,
      plannedTaskCount: 2,
    });

    expect(mocks.postToCliq).toHaveBeenCalledTimes(1);
    const { text } = mocks.postToCliq.mock.calls[0][0];
    expect(text).toContain("*Asha*");
    expect(text).toContain("Recording: https://cliq.zoho.in/chats/abc");
    expect(text).toContain("https://winos.test/report/member/u1u1u1u1u1?date=2026-10-06");
    expect(mocks.db.dsrEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cliqError: null }) })
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/report?submitted=1");
  });

  it("marks a report submitted after 6 AM the next day as late", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T01:00:00.000Z")); // 6:30 AM IST the next day
    try {
      await saveDsr({}, form());
    } finally {
      vi.useRealTimers();
    }
    expect(mocks.db.dsrEntry.upsert.mock.calls[0][0].create.isLate).toBe(true);
  });

  it("is not late when submitted after midnight but before 6 AM", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T20:00:00.000Z")); // 1:30 AM IST the next day — still on time
    try {
      await saveDsr({}, form());
    } finally {
      vi.useRealTimers();
    }
    expect(mocks.db.dsrEntry.upsert.mock.calls[0][0].create.isLate).toBe(false);
  });

  it("still saves the report when the Cliq post fails, and records the error", async () => {
    mocks.postToCliq.mockResolvedValue({ ok: false, error: "Cliq responded 401" });
    vi.spyOn(console, "error").mockImplementation(() => { });

    await saveDsr({}, form());

    expect(mocks.db.dsrEntry.upsert).toHaveBeenCalled();
    expect(mocks.db.dsrEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { cliqError: "Cliq responded 401" } })
    );
    expect(mocks.redirect).toHaveBeenCalled();
  });

  it("lets the report be submitted before the DSM is reviewed", async () => {
    mocks.db.standupEntry.findUnique.mockResolvedValue({ status: "SUBMITTED", blockers: [], supportNeeds: [] });

    await saveDsr({}, form());

    expect(mocks.db.dsrEntry.upsert.mock.calls[0][0].create.status).toBe("SUBMITTED");
    expect(mocks.redirect).toHaveBeenCalledWith("/report?submitted=1");
  });

  it("lets the report be submitted when there is no DSM for the day", async () => {
    mocks.db.standupEntry.findUnique.mockResolvedValue(null);

    await saveDsr({}, form());

    expect(mocks.db.dsrEntry.upsert).toHaveBeenCalled();
  });

  it("bails with a friendly message when the session user no longer exists", async () => {
    mocks.db.user.findUnique.mockResolvedValue(null);

    const res = await saveDsr({}, form());

    expect(res.message).toMatch(/sign in again/i);
    expect(mocks.db.dsrEntry.upsert).not.toHaveBeenCalled();
  });
});
