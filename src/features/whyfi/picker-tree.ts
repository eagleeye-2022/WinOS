/**
 * Pure helpers behind the Whyfi School Task List → Task → Subtask pickers (WhyfiTaskSelectors).
 * They work on the flat list of open cards the picker receives (`WhyfiPickerTask[]`).
 */

export type PickerCard = {
  id: string;
  code: string;
  /** The card's own title. */
  name: string;
  parentTaskId: string | null;
  projectId: string;
  listName: string;
};

/** Distinct task lists, in the order they first appear. */
export function pickerLists(cards: PickerCard[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const c of cards) if (!seen.has(c.projectId)) seen.set(c.projectId, c.listName);
  return [...seen].map(([id, name]) => ({ id, name }));
}

/** The top-level card a card sits under — itself when its parent isn't in the list (e.g. closed). */
export function topLevelCard<C extends PickerCard>(cards: C[], card: C): C {
  const byId = new Map(cards.map((c) => [c.id, c]));
  let cur = card;
  const seen = new Set<string>();
  while (cur.parentTaskId && byId.has(cur.parentTaskId) && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = byId.get(cur.parentTaskId)!;
  }
  return cur;
}

/** Top-level cards of a list; a subtask whose parent isn't in the picker counts as top-level. */
export function topLevelCardsOfList<C extends PickerCard>(cards: C[], listId: string): C[] {
  const ids = new Set(cards.map((c) => c.id));
  return cards.filter((c) => c.projectId === listId && (!c.parentTaskId || !ids.has(c.parentTaskId)));
}

/** Every card below `taskId` (any depth), labelled "[code] Sub › Sub-sub". */
export function subtaskOptions(cards: PickerCard[], taskId: string): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const walk = (parentId: string, prefix: string, depth: number) => {
    if (depth > 20) return; // guards against a cyclic parent chain in bad data
    for (const c of cards) {
      if (c.parentTaskId !== parentId) continue;
      const path = prefix ? `${prefix} › ${c.name}` : c.name;
      out.push({ value: c.id, label: `[${c.code}] ${path}` });
      walk(c.id, path, depth + 1);
    }
  };
  if (taskId) walk(taskId, "", 0);
  return out;
}
