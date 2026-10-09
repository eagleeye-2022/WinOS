import { describe, it, expect, vi, beforeEach } from "vitest";

// iNotes card timeline: wording, the synthesised "created" event for old cards, logging from
// each card action (never blocking the save), and who may read a card's timeline.

const mocks = vi.hoisted(() => {
  const fn = () => vi.fn();
  const db = {
    user: { findUnique: fn() },
    project: { findMany: fn(), count: fn() },
    thread: { findUnique: fn(), create: fn() },
    threadShare: { findMany: fn(), createMany: fn() },
    boardNote: { findUnique: fn(), create: fn(), update: fn() },
    boardNoteShare: { createMany: fn() },
    boardNoteChecklistItem: { findUnique: fn(), update: fn(), deleteMany: fn(), createMany: fn() },
    boardNoteProjectShare: { findMany: fn(), deleteMany: fn(), createMany: fn(), count: fn() },
    boardNoteActivity: { create: fn(), findMany: fn() },
  };
  return { db, auth: vi.fn() };
});

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { buildTimeline, describeNoteActivity, roleLabel } from "@/features/notes/note-activity-utils";
import { createBoardNote } from "@/features/notes/actions/create-board-note";
import { updateBoardNote } from "@/features/notes/actions/update-board-note";
import { toggleBoardNoteItem } from "@/features/notes/actions/toggle-board-note-item";
import { moveBoardNote } from "@/features/notes/actions/move-board-note";
import { shareNoteToProjects } from "@/features/notes/actions/share-note-to-projects";
import { getNoteTimeline } from "@/features/notes/actions/get-note-timeline";

const d = mocks.db;

const USERS: Record<string, { name: string; email: string; role: string; isActive: boolean }> = {
  manager: { name: "Mia Manager", email: "mia@eagleeyedigital.io", role: "MANAGER", isActive: true },
  member: { name: "Max Member", email: "max@eagleeyedigital.io", role: "TEAM_MEMBER", isActive: true },
  outsider: { name: "Olly Out", email: "olly@eagleeyedigital.io", role: "TEAM_MEMBER", isActive: true },
};

function loginAs(userId: keyof typeof USERS) {
  mocks.auth.mockResolvedValue({ user: { id: userId, role: USERS[userId].role } });
}

function fd(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

const loggedActions = () =>
  (d.boardNoteActivity.create.mock.calls as [{ data: { action: string; detail: string | null } }][]).map((c) => [
    c[0].data.action,
    c[0].data.detail,
  ]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  d.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => USERS[where.id] ?? null);
  d.boardNoteActivity.create.mockResolvedValue({});
  d.threadShare.findMany.mockResolvedValue([]);
  d.boardNoteProjectShare.count.mockResolvedValue(0);
  d.boardNoteProjectShare.findMany.mockResolvedValue([]);
});

// ── Pure helpers ────────────────────────────────────────────────────────────
describe("describeNoteActivity / roleLabel", () => {
  it("words every event type", () => {
    expect(describeNoteActivity("CREATED")).toBe("created the card");
    expect(describeNoteActivity("UPDATED")).toBe("updated the card");
    expect(describeNoteActivity("CHECKLIST_CHECKED", "Draft")).toBe('checked "Draft"');
    expect(describeNoteActivity("CHECKLIST_UNCHECKED", "Draft")).toBe('unchecked "Draft"');
    expect(describeNoteActivity("MOVED", "Done")).toBe('moved the card to "Done"');
    expect(describeNoteActivity("SHARED_TO_PROJECT", "Acme")).toBe("shared the card to Acme");
    expect(describeNoteActivity("REMOVED_FROM_PROJECT", "Acme")).toBe("removed the card from Acme");
    expect(describeNoteActivity("SOMETHING_NEW")).toBe("changed the card");
  });

  it("labels roles", () => {
    expect(roleLabel("MANAGER")).toBe("Manager");
    expect(roleLabel("TEAM_MEMBER")).toBe("Member");
    expect(roleLabel(null)).toBeNull();
  });
});

describe("buildTimeline", () => {
  const card = { id: "n1", createdAt: "2026-10-01T09:00:00.000Z", authorName: "Max Member", authorRole: "TEAM_MEMBER" };

  it("adds a 'created' entry for cards made before the timeline existed, newest first", () => {
    const events = buildTimeline(
      [{ id: "a1", action: "UPDATED", detail: null, userName: "Mia Manager", userRole: "MANAGER", createdAt: "2026-10-05T10:00:00.000Z" }],
      card
    );
    expect(events.map((e) => [e.userName, e.role, e.label])).toEqual([
      ["Mia Manager", "Manager", "updated the card"],
      ["Max Member", "Member", "created the card"],
    ]);
  });

  it("does not duplicate 'created' when it was logged", () => {
    const events = buildTimeline(
      [{ id: "a1", action: "CREATED", detail: null, userName: "Max Member", userRole: "TEAM_MEMBER", createdAt: card.createdAt }],
      card
    );
    expect(events.filter((e) => e.action === "CREATED")).toHaveLength(1);
  });
});

// ── Logging from actions ────────────────────────────────────────────────────
describe("card actions record timeline events", () => {
  it("creating a card logs CREATED by its author", async () => {
    loginAs("member");
    d.thread.findUnique.mockResolvedValue({ id: "t1" });
    d.boardNote.create.mockResolvedValue({ id: "n1", content: "" });
    await createBoardNote({}, fd({ threadId: "t1", content: "x" }));
    expect(d.boardNoteActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ noteId: "n1", userId: "member", userName: "Max Member", userRole: "TEAM_MEMBER", action: "CREATED" }),
    });
  });

  it("a manager editing a project-shared card is logged as the manager", async () => {
    loginAs("manager");
    d.boardNote.findUnique.mockResolvedValue({ id: "n1", authorId: "member", thread: { shares: [], board: { type: "NORMAL" } } });
    d.boardNoteProjectShare.count.mockResolvedValue(1);
    expect((await updateBoardNote({}, fd({ id: "n1", content: "edited" }))).message).toBe("updated");
    expect(d.boardNoteActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userName: "Mia Manager", userRole: "MANAGER", action: "UPDATED" }),
    });
  });

  it("a refused edit logs nothing", async () => {
    loginAs("outsider");
    d.boardNote.findUnique.mockResolvedValue({ id: "n1", authorId: "member", thread: { shares: [], board: { type: "NORMAL" } } });
    expect((await updateBoardNote({}, fd({ id: "n1", content: "x" }))).message).toBe("Unauthorized");
    expect(d.boardNoteActivity.create).not.toHaveBeenCalled();
  });

  it("ticking a checklist item logs which item", async () => {
    loginAs("member");
    d.boardNoteChecklistItem.findUnique.mockResolvedValue({
      id: "i1", noteId: "n1", text: "Draft", checked: false, note: { authorId: "member" },
    });
    await toggleBoardNoteItem({}, fd({ itemId: "i1" }));
    expect(loggedActions()).toEqual([["CHECKLIST_CHECKED", "Draft"]]);
  });

  it("moving a card logs the target list", async () => {
    loginAs("member");
    d.boardNote.findUnique.mockResolvedValue({ authorId: "member" });
    d.thread.findUnique.mockResolvedValue({ title: "Done" });
    await moveBoardNote({}, fd({ noteId: "n1", targetThreadId: "t2" }));
    expect(loggedActions()).toEqual([["MOVED", "Done"]]);
  });

  it("sharing logs one event per project added and removed, with project names", async () => {
    loginAs("manager");
    d.boardNote.findUnique.mockResolvedValue({ authorId: "manager" });
    d.boardNoteProjectShare.findMany.mockResolvedValue([{ projectId: "p2" }]); // already on p2
    d.project.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({ id, name: id === "p1" ? "Acme" : "Beta" }))
    );
    await shareNoteToProjects({}, fd({ noteId: "n1", projectIds: "p1" }));
    expect(loggedActions()).toEqual([
      ["SHARED_TO_PROJECT", "Acme"],
      ["REMOVED_FROM_PROJECT", "Beta"],
    ]);
  });

  it("a timeline write failure never breaks the save", async () => {
    loginAs("member");
    d.boardNote.findUnique.mockResolvedValue({ id: "n1", authorId: "member", thread: { shares: [], board: { type: "NORMAL" } } });
    d.boardNoteActivity.create.mockRejectedValue(new Error("db down"));
    expect((await updateBoardNote({}, fd({ id: "n1", content: "x" }))).message).toBe("updated");
    expect(d.boardNote.update).toHaveBeenCalled();
  });
});

// ── Reading a timeline ──────────────────────────────────────────────────────
describe("getNoteTimeline access", () => {
  const baseNote = {
    id: "n1",
    authorId: "member",
    createdAt: new Date("2026-10-01T09:00:00.000Z"),
    author: { name: "Max Member", email: "max@eagleeyedigital.io", role: "TEAM_MEMBER" },
    shares: [],
    projectShares: [],
    thread: { shares: [], board: { ownerId: "member", shares: [] } },
  };

  it("the author sees the timeline (with the synthesised created entry)", async () => {
    loginAs("member");
    d.boardNote.findUnique.mockResolvedValue(baseNote);
    d.boardNoteActivity.findMany.mockResolvedValue([]);
    const res = await getNoteTimeline("n1");
    if (!res.success) throw new Error(res.error);
    expect(res.events).toHaveLength(1);
    expect(res.events[0]).toMatchObject({ action: "CREATED", userName: "Max Member" });
  });

  it("managers can see any card's timeline", async () => {
    loginAs("manager");
    d.boardNote.findUnique.mockResolvedValue(baseNote);
    d.boardNoteActivity.findMany.mockResolvedValue([]);
    expect((await getNoteTimeline("n1")).success).toBe(true);
  });

  it("members of a project the card is shared to can see it", async () => {
    loginAs("outsider");
    d.boardNote.findUnique.mockResolvedValue({ ...baseNote, projectShares: [{ projectId: "p1" }] });
    d.project.count.mockResolvedValue(1);
    d.boardNoteActivity.findMany.mockResolvedValue([]);
    expect((await getNoteTimeline("n1")).success).toBe(true);
  });

  it("anyone else is refused and no events are read", async () => {
    loginAs("outsider");
    d.boardNote.findUnique.mockResolvedValue({ ...baseNote, projectShares: [{ projectId: "p1" }] });
    d.project.count.mockResolvedValue(0);
    const res = await getNoteTimeline("n1");
    expect(res.success).toBe(false);
    expect(d.boardNoteActivity.findMany).not.toHaveBeenCalled();
  });
});
