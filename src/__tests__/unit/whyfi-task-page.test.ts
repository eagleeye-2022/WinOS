import { describe, expect, it } from "vitest";
import { learningListPrefix, nextTaskCode, parseLearningLineCode, formatLearningLine } from "@/features/whyfi/constants";
import { pickerLists, subtaskOptions, topLevelCard, topLevelCardsOfList, type PickerCard } from "@/features/whyfi/picker-tree";
import {
  isOptimisticId,
  newCardOwners,
  optimisticList,
  optimisticTask,
  withTaskAdded,
} from "@/features/whyfi/board-utils";
import type { WhyfiList, WhyfiTask, WhyfiWorkspace } from "@/features/whyfi/actions";

// ── Task codes ───────────────────────────────────────────────────────────────

describe("nextTaskCode", () => {
  it("continues after the highest number, not the count (no reuse after a delete)", () => {
    // T2 was deleted: 2 tasks remain, but the next code must not be T3 again… it is T4.
    expect(nextTaskCode("WL-1", ["WL-1-T1", "WL-1-T3"])).toBe("WL-1-T4");
  });

  it("starts at T1 for an empty list", () => {
    expect(nextTaskCode("WL-7", [])).toBe("WL-7-T1");
  });

  it("ignores dotted subtask codes and foreign codes", () => {
    expect(nextTaskCode("EEDP-3", ["EEDP-3-T5", "EEDP-3-T5.1", "EEDP-3-T5.2", "LEGACY"])).toBe("EEDP-3-T6");
  });

  it("never goes below the floor (task count) for projects with non-numbered codes", () => {
    expect(nextTaskCode("EEDP-3", ["A", "B", "C"], 3)).toBe("EEDP-3-T4");
  });
});

describe("Whyfi subtask codes stay linkable from DSM learning rows", () => {
  it("a subtask code made with nextTaskCode is recognised in a DSM line", () => {
    const code = nextTaskCode(learningListPrefix("WL-1-T3"), ["WL-1-T1", "WL-1-T2", "WL-1-T3"]);
    expect(code).toBe("WL-1-T4");
    expect(parseLearningLineCode(formatLearningLine(code, "Read chapter 2"))).toBe("WL-1-T4");
  });

  it("the old dotted form is NOT recognised — which is why it was replaced", () => {
    expect(parseLearningLineCode("[WL-1-T3.1] Read chapter 2")).toBeNull();
  });

  it("learningListPrefix strips the task part (also dotted)", () => {
    expect(learningListPrefix("WL-12-T40")).toBe("WL-12");
    expect(learningListPrefix("WL-12-T40.2")).toBe("WL-12");
  });
});

// ── List → Task → Subtask picker ─────────────────────────────────────────────

const card = (id: string, code: string, name: string, parentTaskId: string | null, projectId = "L1"): PickerCard => ({
  id,
  code,
  name,
  parentTaskId,
  projectId,
  listName: projectId === "L1" ? "React Basics" : "SEO",
});

const cards: PickerCard[] = [
  card("t1", "WL-1-T1", "Hooks", null),
  card("s1", "WL-1-T2", "useState", "t1"),
  card("ss1", "WL-1-T3", "Lazy init", "s1"),
  card("s2", "WL-1-T4", "useEffect", "t1"),
  card("t2", "WL-1-T5", "Routing", null),
  card("orphan", "WL-1-T7", "Nested routes", "closed-parent"), // parent is closed → not in the picker
  card("x1", "WL-2-T1", "Keywords", null, "L2"),
];

describe("picker tree", () => {
  it("lists each task list once, in order", () => {
    expect(pickerLists(cards)).toEqual([
      { id: "L1", name: "React Basics" },
      { id: "L2", name: "SEO" },
    ]);
  });

  it("shows top-level tasks of the picked list, including orphaned subtasks", () => {
    expect(topLevelCardsOfList(cards, "L1").map((c) => c.id)).toEqual(["t1", "t2", "orphan"]);
    expect(topLevelCardsOfList(cards, "L2").map((c) => c.id)).toEqual(["x1"]);
    expect(topLevelCardsOfList(cards, "")).toEqual([]);
  });

  it("finds the top-level task of a subtask at any depth", () => {
    expect(topLevelCard(cards, cards.find((c) => c.id === "ss1")!).id).toBe("t1");
    expect(topLevelCard(cards, cards.find((c) => c.id === "t2")!).id).toBe("t2");
    expect(topLevelCard(cards, cards.find((c) => c.id === "orphan")!).id).toBe("orphan");
  });

  it("lists every subtask under a task with its path", () => {
    expect(subtaskOptions(cards, "t1")).toEqual([
      { value: "s1", label: "[WL-1-T2] useState" },
      { value: "ss1", label: "[WL-1-T3] useState › Lazy init" },
      { value: "s2", label: "[WL-1-T4] useEffect" },
    ]);
    expect(subtaskOptions(cards, "t2")).toEqual([]);
    expect(subtaskOptions(cards, "")).toEqual([]);
  });

  it("survives a cyclic parent chain in bad data", () => {
    const cyclic = [card("a", "WL-9-T1", "A", "b"), card("b", "WL-9-T2", "B", "a")];
    expect(() => topLevelCard(cyclic, cyclic[0])).not.toThrow();
    expect(() => subtaskOptions(cyclic, "a")).not.toThrow();
  });
});

// ── Optimistic board updates ─────────────────────────────────────────────────

const me = { id: "u1", name: "Mohit", email: "mohit@eagleeyedigital.io" };

function makeTask(id: string, subtasks: WhyfiTask[] = []): WhyfiTask {
  return { ...optimisticTask(id, null, [], "u1"), id, code: id, subtasks };
}

function makeWorkspace(isManager: boolean): WhyfiWorkspace {
  const list: WhyfiList = {
    id: "L1",
    code: "WL-1",
    name: "React Basics",
    description: "",
    createdAt: "",
    members: [me],
    tasks: [makeTask("t1", [makeTask("s1")]), makeTask("t2")],
  };
  return { isManager, currentUserId: "u1", lists: [list], users: [] } as unknown as WhyfiWorkspace;
}

describe("optimistic board updates", () => {
  it("a new card goes to the end of its list, marked as saving", () => {
    const ws = makeWorkspace(true);
    const next = withTaskAdded(ws, "L1", optimisticTask("Context API", null, [], "u1"));
    const tasks = next.lists[0].tasks;
    expect(tasks.map((t) => t.title)).toEqual(["t1", "t2", "Context API"]);
    expect(isOptimisticId(tasks[2].id)).toBe(true);
    expect(tasks[2].code).toBe("Saving…");
    expect(ws.lists[0].tasks).toHaveLength(2); // original board untouched
  });

  it("a new subtask goes under its parent, even a nested one", () => {
    const ws = makeWorkspace(true);
    const top = withTaskAdded(ws, "L1", optimisticTask("Sub of t2", "t2", [], "u1"));
    expect(top.lists[0].tasks[1].subtasks.map((s) => s.title)).toEqual(["Sub of t2"]);
    const nested = withTaskAdded(ws, "L1", optimisticTask("Sub of s1", "s1", [], "u1"));
    expect(nested.lists[0].tasks[0].subtasks[0].subtasks.map((s) => s.title)).toEqual(["Sub of s1"]);
  });

  it("a new list is added empty and marked as saving", () => {
    const list = optimisticList("SEO Fundamentals");
    expect(list).toMatchObject({ name: "SEO Fundamentals", members: [], tasks: [] });
    expect(isOptimisticId(list.id)).toBe(true);
    expect(isOptimisticId("cmukqp48p001ci0d4dfczjaal")).toBe(false);
  });

  it("owners match the server: members own what they add, managers start unassigned", () => {
    expect(newCardOwners(makeWorkspace(false), makeWorkspace(false).lists[0])).toEqual([me]);
    expect(newCardOwners(makeWorkspace(true), makeWorkspace(true).lists[0])).toEqual([]);
  });
});
