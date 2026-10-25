/**
 * SOP checklist timeline event types (SopChecklistEvent.type) and how they read. Client-safe.
 */

export const SOP_EVENT_TYPES = [
  // The SOP itself
  "TEMPLATE_CREATED",
  "TEMPLATE_IMPORTED",
  "TEMPLATE_UPDATED",
  "TEMPLATE_ARCHIVED",
  "TEMPLATE_RESTORED",
  "TEMPLATE_DELETED",
  "TEMPLATE_PUSHED",
  // Picking it for tasks
  "CHECKLIST_ATTACHED",
  "CHECKLIST_CUSTOM_CREATED",
  "CHECKLIST_REMOVED",
  "CHECKLIST_SYNCED",
  // Work on a task's checklist
  "ITEM_CHECKED",
  "ITEM_UNCHECKED",
  "ITEMS_ALL_CHECKED",
  "ITEMS_ALL_UNCHECKED",
  "ITEM_NOTE_UPDATED",
  "ITEM_ADDED",
  "ITEM_EDITED",
  "ITEM_REMOVED",
  // Closing the task
  "TASK_CLOSED",
  "TASK_FORCE_CLOSED",
] as const;

export type SopEventType = (typeof SOP_EVENT_TYPES)[number];

export type SopEventGroup = "SOP" | "PICKED" | "TICKS" | "ITEMS" | "CLOSING";

export const SOP_EVENT_GROUPS: Record<SopEventGroup, { label: string; types: SopEventType[] }> = {
  SOP: {
    label: "SOP changes",
    types: [
      "TEMPLATE_CREATED",
      "TEMPLATE_IMPORTED",
      "TEMPLATE_UPDATED",
      "TEMPLATE_ARCHIVED",
      "TEMPLATE_RESTORED",
      "TEMPLATE_DELETED",
      "TEMPLATE_PUSHED",
    ],
  },
  PICKED: {
    label: "Picked & removed",
    types: ["CHECKLIST_ATTACHED", "CHECKLIST_CUSTOM_CREATED", "CHECKLIST_REMOVED", "CHECKLIST_SYNCED"],
  },
  TICKS: {
    label: "Ticks",
    types: ["ITEM_CHECKED", "ITEM_UNCHECKED", "ITEMS_ALL_CHECKED", "ITEMS_ALL_UNCHECKED", "ITEM_NOTE_UPDATED"],
  },
  ITEMS: { label: "Extra items", types: ["ITEM_ADDED", "ITEM_EDITED", "ITEM_REMOVED"] },
  CLOSING: { label: "Task closed", types: ["TASK_CLOSED", "TASK_FORCE_CLOSED"] },
};

export interface SopEventView {
  id: string;
  type: SopEventType;
  templateId: string | null;
  templateName: string | null;
  checklistId: string | null;
  taskId: string | null;
  taskCode: string | null;
  taskTitle: string | null;
  projectCode: string | null;
  itemText: string | null;
  details: Record<string, unknown> | null;
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
}

const num = (v: unknown) => (typeof v === "number" ? v : null);
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/**
 * The sentence after the person's name, e.g. "picked this SOP for the task". `inSopTimeline`
 * phrases SOP-level events as "this SOP"; elsewhere the SOP's name is used.
 */
export function describeSopEvent(e: SopEventView, inSopTimeline: boolean): string {
  const sop = inSopTimeline ? "this SOP" : e.templateName ? `the SOP "${e.templateName}"` : "the checklist";
  const d = e.details || {};
  switch (e.type) {
    case "TEMPLATE_CREATED":
      return `created ${sop}${num(d.steps) !== null ? ` with ${d.steps} steps` : ""}`;
    case "TEMPLATE_IMPORTED":
      return `imported ${sop} from the EED SOP sheet${num(d.steps) !== null ? ` (${d.steps} steps)` : ""}`;
    case "TEMPLATE_UPDATED": {
      const parts: string[] = [];
      if (num(d.added)) parts.push(`${d.added} step${d.added === 1 ? "" : "s"} added`);
      if (num(d.removed)) parts.push(`${d.removed} removed`);
      if (num(d.changed)) parts.push(`${d.changed} changed`);
      if (d.renamedFrom) parts.push(`renamed from "${d.renamedFrom}"`);
      const version = num(d.version) !== null ? ` → v${d.version}` : "";
      return `edited ${sop}${version}${parts.length ? ` (${parts.join(", ")})` : ""}`;
    }
    case "TEMPLATE_ARCHIVED":
      return `archived ${sop}`;
    case "TEMPLATE_RESTORED":
      return `restored ${sop}`;
    case "TEMPLATE_DELETED":
      return `deleted ${sop}`;
    case "TEMPLATE_PUSHED":
      return `pushed v${d.version ?? "?"} of ${sop} to ${d.updated ?? 0} task${d.updated === 1 ? "" : "s"}${
        num(d.skippedClosed) ? ` (${d.skippedClosed} closed task${d.skippedClosed === 1 ? "" : "s"} left as they were)` : ""
      }`;
    case "CHECKLIST_ATTACHED":
      return `picked ${sop} for the task${d.via === "bulk" ? " (bulk attach)" : ""}${num(d.version) !== null ? ` · v${d.version}` : ""}`;
    case "CHECKLIST_CUSTOM_CREATED":
      return `added a one-off checklist "${str(d.name) ?? e.templateName ?? ""}" to the task`;
    case "CHECKLIST_REMOVED":
      return `removed ${sop} from the task${num(d.done) !== null ? ` (${d.done}/${d.total} were ticked)` : ""}`;
    case "CHECKLIST_SYNCED":
      return `updated the task's copy of ${sop} to v${d.version ?? "?"}`;
    case "ITEM_CHECKED":
      return `ticked "${e.itemText ?? ""}"`;
    case "ITEM_UNCHECKED":
      return `unticked "${e.itemText ?? ""}"`;
    case "ITEMS_ALL_CHECKED":
      return `ticked all items (${d.count ?? 0})${num(d.skippedForProof) ? ` — ${d.skippedForProof} still need a proof link` : ""}`;
    case "ITEMS_ALL_UNCHECKED":
      return `unticked all items (${d.count ?? 0})`;
    case "ITEM_NOTE_UPDATED":
      return `updated the note / proof link on "${e.itemText ?? ""}"`;
    case "ITEM_ADDED":
      return `added an extra item "${e.itemText ?? ""}" on the task`;
    case "ITEM_EDITED":
      return `renamed an item "${str(d.from) ?? ""}" → "${e.itemText ?? ""}"`;
    case "ITEM_REMOVED":
      return `removed the item "${e.itemText ?? ""}" from the task`;
    case "TASK_CLOSED":
      return `closed the task with the checklist complete${num(d.total) !== null ? ` (${d.done}/${d.total})` : ""}`;
    case "TASK_FORCE_CLOSED":
      return d.reason === "NO_CHECKLIST"
        ? "closed the task without a checklist (manager override)"
        : `closed the task with the checklist incomplete (${d.done ?? "?"}/${d.total ?? "?"}, manager override)`;
    default:
      return String(e.type).toLowerCase().replace(/_/g, " ");
  }
}
