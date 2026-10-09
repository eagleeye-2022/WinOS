import { describe, it, expect, vi, beforeEach } from "vitest";

// Project iNotes (card → project sharing), run with auth/db mocked. Covers sharing a card to a
// project, who can read it in Projects, who can edit it, and that DSM / normal-board rules are
// unchanged.

const mocks = vi.hoisted(() => {
  const fn = () => vi.fn();
  const db = {
    user: { findUnique: fn() },
    project: { findFirst: fn(), findUnique: fn(), findMany: fn(), count: fn() },
    boardNote: { findUnique: fn(), update: fn() },
    boardNoteChecklistItem: { deleteMany: fn(), createMany: fn() },
    boardNoteProjectShare: { findMany: fn(), deleteMany: fn(), createMany: fn(), count: fn() },
  };
  return { db, auth: vi.fn() };
});

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { shareNoteToProjects } from "@/features/notes/actions/share-note-to-projects";
import { updateBoardNote } from "@/features/notes/actions/update-board-note";
import { getShareableProjects } from "@/features/notes/queries";
import {
  getProjectNotesAction,
  getProjectNoteSummariesAction,
} from "@/features/projects/actions/project-notes-actions";

const d = mocks.db;

const USERS: Record<string, { role: string; isActive: boolean }> = {
  manager: { role: "MANAGER", isActive: true },
  member: { role: "TEAM_MEMBER", isActive: true }, // member of p1 only
  outsider: { role: "TEAM_MEMBER", isActive: true }, // on no project
};
const PROJECTS = ["p1", "p2"];

function loginAs(userId: keyof typeof USERS) {
  mocks.auth.mockResolvedValue({ user: { id: userId, role: USERS[userId].role } });
}

function fd(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

/** Card on a board of the given type, authored by `authorId`, optionally already on projects. */
function setupCard(opts: { authorId: string; boardType?: string; sharedTo?: string[] }) {
  const sharedTo = opts.sharedTo ?? [];
  d.boardNote.findUnique.mockResolvedValue({
    id: "n1",
    authorId: opts.authorId,
    thread: { shares: [], board: { type: opts.boardType ?? "NORMAL" } },
  });
  d.boardNoteProjectShare.findMany.mockResolvedValue(sharedTo.map((projectId) => ({ projectId })));
  d.boardNoteProjectShare.count.mockResolvedValue(sharedTo.length);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  d.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => USERS[where.id] ?? null);
  d.project.findFirst.mockImplementation(async ({ where }: { where: { OR: { id?: string; code?: string }[] } }) =>
    where.OR.some((c) => c.id === "p1" || c.code === "ACME-1") ? { id: "p1" } : null
  );
  d.project.findUnique.mockResolvedValue({ name: "Acme" });
  // Real ids only (used to validate a share request).
  d.project.findMany.mockImplementation(async ({ where }: { where?: { id?: { in: string[] } } }) =>
    where?.id?.in ? where.id.in.filter((id) => PROJECTS.includes(id)).map((id) => ({ id })) : []
  );
  // Membership: "member" is on p1 only (the where clause embeds the userId).
  d.project.count.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === "p1" && JSON.stringify(where).includes('"member"') ? 1 : 0
  );
});

// ── Sharing a card to projects ──────────────────────────────────────────────
describe("shareNoteToProjects", () => {
  it("lets the author share their card to a project they belong to", async () => {
    loginAs("member");
    setupCard({ authorId: "member" });
    const res = await shareNoteToProjects({}, fd({ noteId: "n1", projectIds: "p1" }));
    expect(res.message).toBe("shared");
    expect(d.boardNoteProjectShare.createMany).toHaveBeenCalledWith({
      data: [{ noteId: "n1", projectId: "p1", sharedById: "member" }],
      skipDuplicates: true,
    });
  });

  it("lets the author share to any project, including ones they are not a member of", async () => {
    loginAs("member");
    setupCard({ authorId: "member" });
    const res = await shareNoteToProjects({}, fd({ noteId: "n1", projectIds: "p1,p2" }));
    expect(res.message).toBe("shared");
    expect(d.boardNoteProjectShare.createMany).toHaveBeenCalledWith({
      data: [
        { noteId: "n1", projectId: "p1", sharedById: "member" },
        { noteId: "n1", projectId: "p2", sharedById: "member" },
      ],
      skipDuplicates: true,
    });
  });

  it("lets a manager share their card to any project", async () => {
    loginAs("manager");
    setupCard({ authorId: "manager" });
    expect((await shareNoteToProjects({}, fd({ noteId: "n1", projectIds: "p1,p2" }))).message).toBe("shared");
  });

  it("refuses anyone but the card's author — even a manager", async () => {
    loginAs("manager");
    setupCard({ authorId: "member" });
    const res = await shareNoteToProjects({}, fd({ noteId: "n1", projectIds: "p1" }));
    expect(res.message).toMatch(/author/);
    expect(d.boardNoteProjectShare.createMany).not.toHaveBeenCalled();
  });

  it("refuses unknown projects", async () => {
    loginAs("manager");
    setupCard({ authorId: "manager" });
    expect((await shareNoteToProjects({}, fd({ noteId: "n1", projectIds: "nope" }))).message).toBe("Project not found");
  });

  it("unsharing removes the deselected projects; an empty list removes all", async () => {
    loginAs("manager");
    setupCard({ authorId: "manager", sharedTo: ["p1", "p2"] });
    await shareNoteToProjects({}, fd({ noteId: "n1", projectIds: "p1" }));
    expect(d.boardNoteProjectShare.deleteMany).toHaveBeenCalledWith({
      where: { noteId: "n1", projectId: { notIn: ["p1"] } },
    });
    await shareNoteToProjects({}, fd({ noteId: "n1", projectIds: "" }));
    expect(d.boardNoteProjectShare.deleteMany).toHaveBeenLastCalledWith({ where: { noteId: "n1" } });
  });

  it("an author who left a project can still keep or remove it (only new projects are checked)", async () => {
    loginAs("outsider");
    setupCard({ authorId: "outsider", sharedTo: ["p2"] });
    expect((await shareNoteToProjects({}, fd({ noteId: "n1", projectIds: "p2" }))).message).toBe("shared");
    expect((await shareNoteToProjects({}, fd({ noteId: "n1", projectIds: "" }))).message).toBe("shared");
  });
});

// ── Editing ─────────────────────────────────────────────────────────────────
describe("updateBoardNote with project sharing", () => {
  it("any manager may edit a card once it is shared to a project", async () => {
    loginAs("manager");
    setupCard({ authorId: "member", sharedTo: ["p1"] });
    expect((await updateBoardNote({}, fd({ id: "n1", content: "edited" }))).message).toBe("updated");
  });

  it("project members (non-authors) cannot edit a shared card", async () => {
    loginAs("member");
    setupCard({ authorId: "manager", sharedTo: ["p1"] });
    expect((await updateBoardNote({}, fd({ id: "n1", content: "x" }))).message).toBe("Unauthorized");
    expect(d.boardNote.update).not.toHaveBeenCalled();
  });

  it("unchanged: a manager still cannot edit someone's normal card that is NOT shared to a project", async () => {
    loginAs("manager");
    setupCard({ authorId: "member" });
    expect((await updateBoardNote({}, fd({ id: "n1", content: "x" }))).message).toBe("Unauthorized");
  });

  it("unchanged: managers edit DSM cards and authors edit their own, as before", async () => {
    loginAs("manager");
    setupCard({ authorId: "member", boardType: "DSM" });
    expect((await updateBoardNote({}, fd({ id: "n1", content: "x" }))).message).toBe("updated");
    loginAs("member");
    setupCard({ authorId: "member" });
    expect((await updateBoardNote({}, fd({ id: "n1", content: "x" }))).message).toBe("updated");
  });
});

// ── Picker contents ─────────────────────────────────────────────────────────
describe("getShareableProjects", () => {
  it("lists every project for managers and members alike", async () => {
    d.project.findMany.mockResolvedValue([]);
    loginAs("manager");
    await getShareableProjects();
    expect(d.project.findMany.mock.calls[0][0].where).toBeUndefined();
    loginAs("member");
    await getShareableProjects();
    expect(d.project.findMany.mock.calls[1][0].where).toBeUndefined();
  });
});

// ── Projects module: reading shared cards ───────────────────────────────────
describe("getProjectNotesAction", () => {
  const shareRow = {
    createdAt: new Date("2026-10-02"),
    note: {
      id: "n1",
      title: "API",
      content: "<p>v2</p>",
      color: null,
      deadline: null,
      updatedAt: new Date("2026-10-01"),
      authorId: "manager",
      author: { name: "Mia Manager", email: "mia@eagleeyedigital.io" },
      checklistItems: [{ id: "c1", text: "Draft", checked: true }],
      thread: { title: "Specs", board: { name: "Sprint" } },
    },
  };

  it("members read every shared card but cannot edit", async () => {
    loginAs("member");
    d.boardNoteProjectShare.findMany.mockResolvedValue([shareRow]);
    const res = await getProjectNotesAction("ACME-1");
    if (!res.success) throw new Error(res.error);
    expect(res.isManager).toBe(false);
    expect(res.cards[0]).toMatchObject({ id: "n1", canEdit: false, authorName: "Mia Manager", source: "Sprint / Specs" });
    expect(d.boardNoteProjectShare.findMany.mock.calls[0][0].where).toEqual({ projectId: "p1" });
  });

  it("managers can edit every shared card", async () => {
    loginAs("manager");
    d.boardNoteProjectShare.findMany.mockResolvedValue([{ ...shareRow, note: { ...shareRow.note, authorId: "member" } }]);
    const res = await getProjectNotesAction("p1");
    if (!res.success) throw new Error(res.error);
    expect(res.isManager).toBe(true);
    expect(res.cards[0].canEdit).toBe(true);
  });

  it("outsiders are refused and nothing is read", async () => {
    loginAs("outsider");
    const res = await getProjectNotesAction("p1");
    expect(res.success).toBe(false);
    expect(d.boardNoteProjectShare.findMany).not.toHaveBeenCalled();
  });
});

describe("getProjectNoteSummariesAction (Project iNotes column)", () => {
  it("returns the latest shared card's title and the count, keyed by the id or code passed", async () => {
    loginAs("member");
    d.project.findMany.mockResolvedValue([{ id: "p1", code: "ACME-1" }]);
    // Newest first (the action orders by createdAt desc).
    d.boardNoteProjectShare.findMany.mockResolvedValue([
      { projectId: "p1", note: { title: "  Launch checklist " } },
      { projectId: "p1", note: { title: "Older card" } },
    ]);
    expect(await getProjectNoteSummariesAction(["ACME-1", "OTHER"])).toEqual({
      "ACME-1": { count: 2, latestTitle: "Launch checklist" },
    });
    expect(d.boardNoteProjectShare.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: "desc" });
    expect(JSON.stringify(d.project.findMany.mock.calls[0][0].where)).toContain('"member"');
  });

  it("reports nothing shared as count 0 (the cell shows 'No notes shared')", async () => {
    loginAs("member");
    d.project.findMany.mockResolvedValue([{ id: "p1", code: null }]);
    d.boardNoteProjectShare.findMany.mockResolvedValue([]);
    expect(await getProjectNoteSummariesAction(["p1"])).toEqual({ p1: { count: 0, latestTitle: null } });
  });

  it("an untitled latest card gives a null title (the cell shows 'Untitled Note')", async () => {
    loginAs("manager");
    d.project.findMany.mockResolvedValue([{ id: "p1", code: null }]);
    d.boardNoteProjectShare.findMany.mockResolvedValue([{ projectId: "p1", note: { title: null } }]);
    expect(await getProjectNoteSummariesAction(["p1"])).toEqual({ p1: { count: 1, latestTitle: null } });
  });

  it("returns an empty map when signed out", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await getProjectNoteSummariesAction(["p1"])).toEqual({});
  });
});
