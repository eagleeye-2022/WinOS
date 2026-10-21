import type { WhyfiList, WhyfiTask, WhyfiUser, WhyfiWorkspace } from "./actions";

/**
 * Optimistic updates for the WhyFi School board: a new list / card / subtask is put on the board
 * straight away with a temporary id, and replaced by the saved one when the board reloads.
 */

const OPTIMISTIC_PREFIX = "optimistic-";

export const isOptimisticId = (id: string) => id.startsWith(OPTIMISTIC_PREFIX);
export const optimisticId = () => `${OPTIMISTIC_PREFIX}${Math.random().toString(36).slice(2)}`;

/** A card as the server will create it (Open, at the end of its list), shown until the reload. */
export function optimisticTask(
  title: string,
  parentTaskId: string | null,
  owners: WhyfiUser[],
  authorId: string
): WhyfiTask {
  return {
    id: optimisticId(),
    code: "Saving…",
    title,
    description: "",
    status: "Open",
    dueDate: "",
    authorId,
    authorName: "",
    owners,
    loggedMinutes: 0,
    myLoggedMinutes: 0,
    createdAt: new Date().toISOString(),
    parentTaskId,
    subtasks: [],
  };
}

/** A list as the server will create it (empty, not shared yet, at the end of the board). */
export function optimisticList(name: string): WhyfiList {
  return {
    id: optimisticId(),
    code: "",
    name,
    description: "",
    createdAt: new Date().toISOString(),
    members: [],
    tasks: [],
  };
}

/** Adds a card to a list — or, with `task.parentTaskId`, a subtask under that card at any depth. */
export function withTaskAdded(ws: WhyfiWorkspace, listId: string, task: WhyfiTask): WhyfiWorkspace {
  const addUnder = (tasks: WhyfiTask[]): WhyfiTask[] =>
    tasks.map((t) =>
      t.id === task.parentTaskId ? { ...t, subtasks: [...t.subtasks, task] } : { ...t, subtasks: addUnder(t.subtasks) }
    );
  return {
    ...ws,
    lists: ws.lists.map((l) =>
      l.id !== listId ? l : { ...l, tasks: task.parentTaskId ? addUnder(l.tasks) : [...l.tasks, task] }
    ),
  };
}

/** Owners the server gives a new card: members own what they add; managers' cards start unassigned. */
export function newCardOwners(ws: WhyfiWorkspace, list: WhyfiList): WhyfiUser[] {
  if (ws.isManager) return [];
  const me = list.members.find((m) => m.id === ws.currentUserId);
  return me ? [me] : [];
}
