import { describe, expect, it } from "vitest";
import { moveId, orderLists, withTaskMoved } from "@/features/whyfi/board-utils";
import type { WhyfiList, WhyfiTask, WhyfiWorkspace } from "@/features/whyfi/actions";

const card = (id: string): WhyfiTask => ({
  id,
  code: id.toUpperCase(),
  title: id,
  description: "",
  status: "Open",
  dueDate: "",
  authorId: "u1",
  authorName: "",
  owners: [],
  loggedMinutes: 0,
  myLoggedMinutes: 0,
  createdAt: "2026-10-01T00:00:00.000Z",
  parentTaskId: null,
  subtasks: [],
});

const list = (id: string, cards: string[]): WhyfiList => ({
  id,
  code: id,
  name: id,
  description: "",
  createdAt: "2026-10-01T00:00:00.000Z",
  members: [],
  tasks: cards.map(card),
});

const ws = (lists: WhyfiList[]): WhyfiWorkspace =>
  ({ isManager: true, currentUserId: "u1", lists, users: [] }) as unknown as WhyfiWorkspace;

const ids = (w: WhyfiWorkspace, listId: string) => w.lists.find((l) => l.id === listId)!.tasks.map((t) => t.id);

describe("withTaskMoved", () => {
  const board = ws([list("A", ["a1", "a2", "a3"]), list("B", ["b1"])]);

  it("reorders within a list (index counts the list without the dragged card)", () => {
    const res = withTaskMoved(board, "a1", "A", 2)!;
    expect(ids(res.workspace, "A")).toEqual(["a2", "a3", "a1"]);
    expect(res.orderedIds).toEqual(["a2", "a3", "a1"]);
    expect(ids(withTaskMoved(board, "a3", "A", 0)!.workspace, "A")).toEqual(["a3", "a1", "a2"]);
  });

  it("moves a card to another list at the drop position", () => {
    const res = withTaskMoved(board, "a2", "B", 0)!;
    expect(ids(res.workspace, "A")).toEqual(["a1", "a3"]);
    expect(ids(res.workspace, "B")).toEqual(["a2", "b1"]);
    expect(res.orderedIds).toEqual(["a2", "b1"]);
  });

  it("clamps the index and ignores unknown cards or lists", () => {
    expect(ids(withTaskMoved(board, "a1", "B", 99)!.workspace, "B")).toEqual(["b1", "a1"]);
    expect(withTaskMoved(board, "nope", "B", 0)).toBeNull();
    expect(withTaskMoved(board, "a1", "nope", 0)).toBeNull();
  });
});

describe("list order", () => {
  it("applies the saved order and keeps new lists after it, in board order", () => {
    const lists = [{ id: "L1" }, { id: "L2" }, { id: "L3" }, { id: "L4" }];
    expect(orderLists(lists, ["L3", "L1"]).map((l) => l.id)).toEqual(["L3", "L1", "L2", "L4"]);
    expect(orderLists(lists, ["gone", "L2"]).map((l) => l.id)).toEqual(["L2", "L1", "L3", "L4"]);
    expect(orderLists(lists, []).map((l) => l.id)).toEqual(["L1", "L2", "L3", "L4"]);
  });

  it("moveId puts an id at a position", () => {
    expect(moveId(["L1", "L2", "L3"], "L1", 2)).toEqual(["L2", "L3", "L1"]);
    expect(moveId(["L1", "L2", "L3"], "L3", 0)).toEqual(["L3", "L1", "L2"]);
  });
});
