// Pure helpers for the iNotes card timeline (no DB access, unit-tested).

export const NOTE_ACTIVITY = {
  CREATED: "CREATED",
  UPDATED: "UPDATED",
  CHECKLIST_CHECKED: "CHECKLIST_CHECKED",
  CHECKLIST_UNCHECKED: "CHECKLIST_UNCHECKED",
  MOVED: "MOVED",
  SHARED_TO_PROJECT: "SHARED_TO_PROJECT",
  REMOVED_FROM_PROJECT: "REMOVED_FROM_PROJECT",
} as const;

export type NoteActivityAction = (typeof NOTE_ACTIVITY)[keyof typeof NOTE_ACTIVITY];

/** Sentence fragment that follows the person's name, e.g. "updated the card". */
export function describeNoteActivity(action: string, detail?: string | null): string {
  const d = detail?.trim();
  switch (action) {
    case NOTE_ACTIVITY.CREATED:
      return "created the card";
    case NOTE_ACTIVITY.UPDATED:
      return "updated the card";
    case NOTE_ACTIVITY.CHECKLIST_CHECKED:
      return d ? `checked "${d}"` : "checked a checklist item";
    case NOTE_ACTIVITY.CHECKLIST_UNCHECKED:
      return d ? `unchecked "${d}"` : "unchecked a checklist item";
    case NOTE_ACTIVITY.MOVED:
      return d ? `moved the card to "${d}"` : "moved the card";
    case NOTE_ACTIVITY.SHARED_TO_PROJECT:
      return d ? `shared the card to ${d}` : "shared the card to a project";
    case NOTE_ACTIVITY.REMOVED_FROM_PROJECT:
      return d ? `removed the card from ${d}` : "removed the card from a project";
    default:
      return "changed the card";
  }
}

/** Display label for the role snapshot stored with each event. */
export function roleLabel(role: string | null | undefined): string | null {
  const r = String(role || "").toUpperCase();
  if (r === "MANAGER") return "Manager";
  if (r === "TEAM_MEMBER") return "Member";
  return null;
}

export type TimelineEvent = {
  id: string;
  action: string;
  label: string;
  userName: string;
  role: string | null;
  createdAt: string;
};

type RawEvent = {
  id: string;
  action: string;
  detail: string | null;
  userName: string;
  userRole: string | null;
  createdAt: Date | string;
};

/**
 * Newest-first timeline. Cards created before the timeline existed have no CREATED row, so one
 * is synthesised from the card's own author and createdAt (nothing is written to the DB).
 */
export function buildTimeline(
  rows: RawEvent[],
  card: { id: string; createdAt: Date | string; authorName: string; authorRole: string | null }
): TimelineEvent[] {
  const events: TimelineEvent[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    label: describeNoteActivity(r.action, r.detail),
    userName: r.userName,
    role: roleLabel(r.userRole),
    createdAt: new Date(r.createdAt).toISOString(),
  }));

  if (!rows.some((r) => r.action === NOTE_ACTIVITY.CREATED)) {
    events.push({
      id: `created-${card.id}`,
      action: NOTE_ACTIVITY.CREATED,
      label: describeNoteActivity(NOTE_ACTIVITY.CREATED),
      userName: card.authorName,
      role: roleLabel(card.authorRole),
      createdAt: new Date(card.createdAt).toISOString(),
    });
  }

  return events.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
