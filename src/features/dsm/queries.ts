import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toUtcDate, getWeekRange } from "./utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EntryTask = {
  id: string;
  kind: "YESTERDAY" | "TODAY";
  text: string;
  order: number;
  priority?: string | null;
  managerPriority?: string | null;
};

export type EntryBlocker = {
  id: string;
  text: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  resolved: boolean;
  mentionedUserId?: string | null;
  mentionedUserIds?: string | null;
  mentionedUser?: { id: string; name: string | null; email: string } | null;
  mentionedUsers?: { id: string; name: string | null; email: string }[];
  editedById?: string | null;
  editedBy?: { id: string; name: string | null; email: string } | null;
};

export type EntrySupportNeed = {
  id: string;
  text: string;
  mentionedUserId?: string | null;
  mentionedUserIds?: string | null;
  mentionedUser: { id: string; name: string | null; email: string } | null;
  mentionedUsers?: { id: string; name: string | null; email: string }[];
  order: number;
  editedById?: string | null;
  editedBy?: { id: string; name: string | null; email: string } | null;
};

export type EntryWithDetails = {
  id: string;
  date: Date;
  status: "DRAFT" | "SUBMITTED" | "PENDING_REVIEW" | "REVIEWED" | "MISSED";
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: { name: string | null; email: string } | null;
  learningText: string | null;
  tasks: EntryTask[];
  blockers: EntryBlocker[];
  supportNeeds: EntrySupportNeed[];
};

export type WorkspaceNoteData = {
  id: string;
  title: string;
  body: string;
  keyNote: string | null;
  owner: { id: string; name: string | null; email: string };
  actionItems: { id: string; text: string; checked: boolean; order: number }[];
  updatedAt: Date;
};

export type KpiStats = {
  submissionRate: number;
  submissionRateDelta: number;
  supportMeetingsCount: number;
  resolvedBlockers: number;
};

export type TeamMember = {
  id: string;
  name: string | null;
  email: string;
  title: string | null;
  role: "TEAM_MEMBER" | "MANAGER";
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const entryInclude = {
  tasks: { orderBy: { order: "asc" } },
  blockers: {
    include: {
      mentionedUser: { select: { id: true, name: true, email: true } },
      editedBy: { select: { id: true, name: true, email: true } },
    },
  },
  supportNeeds: {
    orderBy: { order: "asc" },
    include: {
      mentionedUser: { select: { id: true, name: true, email: true } },
      editedBy: { select: { id: true, name: true, email: true } },
    },
  },
  reviewedBy: { select: { name: true, email: true } },
};

/**
 * Resolves the "@mention" chips shown on blockers/support-needed rows.
 * `mentionedUserId` only ever holds the first tagged user (legacy single-mention
 * column); the full set lives in `mentionedUserIds` as a comma-separated list.
 * This fetches all tagged users in one query and attaches them as `mentionedUsers`
 * so every tagged person renders, not just the first.
 */
async function attachMentionedUsers<
  T extends {
    blockers: { mentionedUserId?: string | null; mentionedUserIds?: string | null }[];
    supportNeeds: { mentionedUserId?: string | null; mentionedUserIds?: string | null }[];
  }
>(entries: T[]): Promise<T[]> {
  const idsToMention = (item: { mentionedUserId?: string | null; mentionedUserIds?: string | null }) =>
    item.mentionedUserIds
      ? item.mentionedUserIds.split(",").filter(Boolean)
      : item.mentionedUserId
        ? [item.mentionedUserId]
        : [];

  const allIds = new Set<string>();
  for (const entry of entries) {
    for (const item of [...entry.blockers, ...entry.supportNeeds]) {
      idsToMention(item).forEach((id) => allIds.add(id));
    }
  }
  if (allIds.size === 0) return entries;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = await (db as any).user.findMany({
    where: { id: { in: Array.from(allIds) } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u: { id: string }) => [u.id, u]));

  const attach = <I extends { mentionedUserId?: string | null; mentionedUserIds?: string | null }>(item: I) => ({
    ...item,
    mentionedUsers: idsToMention(item)
      .map((id) => userMap.get(id))
      .filter((u): u is { id: string; name: string | null; email: string } => Boolean(u)),
  });

  return entries.map((entry) => ({
    ...entry,
    blockers: entry.blockers.map(attach),
    supportNeeds: entry.supportNeeds.map(attach),
  }));
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Today's entry (DRAFT or submitted) for the current user. */
export async function getTodayEntry(): Promise<EntryWithDetails | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const today = toUtcDate();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entry = await (db as any).standupEntry.findUnique({
    where: { userId_date: { userId: session.user.id, date: today } },
    include: entryInclude,
  });
  if (!entry) return null;

  const [resolved] = await attachMentionedUsers([entry]);
  return resolved as EntryWithDetails;
}

/**
 * Tasks from the most recent *submitted* entry before today.
 * Shown as "What did you complete yesterday?" in the form.
 * Uses findFirst (not findUnique on D-1) so Monday correctly shows Friday's work
 * and any non-working day gap is bridged automatically.
 */
export async function getYesterdayTasks(): Promise<string[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const today = toUtcDate();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entry = await (db as any).standupEntry.findFirst({
    where: {
      userId: session.user.id,
      date: { lt: today },
      status: { in: ["SUBMITTED", "PENDING_REVIEW", "REVIEWED"] },
    },
    include: { tasks: { where: { kind: "TODAY" }, orderBy: { order: "asc" } } },
    orderBy: { date: "desc" },
  });

  return (entry?.tasks ?? []).map((t: EntryTask) => t.text);
}

/**
 * Yesterday's TODAY tasks that were NOT marked complete.
 * Completion state for a DSM task doesn't live on StandupTask itself — it's recorded
 * on that same day's evening DsrEntry.plannedTasks (matched by text, no FK between them).
 * If no DSR was ever filed for that day, nothing confirms completion, so every task
 * from that day is treated as incomplete.
 */
export async function getYesterdayIncompleteTasks(): Promise<string[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const today = toUtcDate();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const entry = await d.standupEntry.findFirst({
    where: {
      userId: session.user.id,
      date: { lt: today },
      status: { in: ["SUBMITTED", "PENDING_REVIEW", "REVIEWED"] },
    },
    include: { tasks: { where: { kind: "TODAY" }, orderBy: { order: "asc" } } },
    orderBy: { date: "desc" },
  });

  if (!entry || entry.tasks.length === 0) return [];

  const dsr = await d.dsrEntry.findUnique({
    where: { userId_date: { userId: session.user.id, date: entry.date } },
    include: { plannedTasks: { select: { text: true, completed: true } } },
  });

  if (!dsr) {
    return entry.tasks.map((t: EntryTask) => t.text);
  }

  const completedTexts = new Set(
    dsr.plannedTasks
      .filter((p: { completed: boolean }) => p.completed)
      .map((p: { text: string }) => p.text)
  );

  return entry.tasks
    .filter((t: EntryTask) => !completedTexts.has(t.text))
    .map((t: EntryTask) => t.text);
}

/** All entries in the given week offset for the current user (desc date order). */
export async function getWeekEntries(weekOffset = 0): Promise<EntryWithDetails[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const { start, end } = getWeekRange(weekOffset);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries = await (db as any).standupEntry.findMany({
    where: { userId: session.user.id, date: { gte: start, lte: end } },
    include: entryInclude,
    orderBy: { date: "desc" },
  });

  const resolved = await attachMentionedUsers(entries);
  return resolved as EntryWithDetails[];
}

/**
 * Workspace note to display in the right panel.
 * Members see the manager's note (team focus); managers see their own.
 */
export async function getWorkspaceNote(): Promise<WorkspaceNoteData | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const include = {
    owner: { select: { id: true, name: true, email: true } },
    actionItems: { orderBy: { order: "asc" } },
  };

  if (session.user.role === "TEAM_MEMBER") {
    // Show the first manager's workspace note as the team focus note
    const note = await d.dsmWorkspaceNote.findFirst({
      where: { owner: { role: "MANAGER" } },
      include,
      orderBy: { updatedAt: "desc" },
    });
    return note as WorkspaceNoteData | null;
  }

  const note = await d.dsmWorkspaceNote.findUnique({
    where: { ownerId: session.user.id },
    include,
  });
  return note as WorkspaceNoteData | null;
}

/** KPI metrics computed from real data. */
export async function getKpiStats(weekOffset: number = 0): Promise<KpiStats> {
  const session = await auth();
  if (!session?.user?.id) {
    return { submissionRate: 0, submissionRateDelta: 0, supportMeetingsCount: 0, resolvedBlockers: 0 };
  }

  const now = new Date();
  const { start: thisWeekStart, end: thisWeekEnd } = getWeekRange(weekOffset, now);
  const { start: lastWeekStart, end: lastWeekEnd } = getWeekRange(weekOffset - 1, now);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Submission rate = submitted+reviewed entries / weekdays in the 4 weeks ending with the selected week
  const rateEnd = thisWeekEnd < now ? thisWeekEnd : now;
  const fourWeeksAgo = new Date(rateEnd);
  fourWeeksAgo.setDate(rateEnd.getDate() - 28);

  const allEntries = await d.standupEntry.findMany({
    where: { userId: session.user.id, date: { gte: fourWeeksAgo, lte: rateEnd } },
    select: { status: true, date: true },
  });

  const workingDays = countWeekdays(fourWeeksAgo, rateEnd);
  const submittedCount = allEntries.filter(
    (e: { status: string }) => e.status !== "DRAFT" && e.status !== "MISSED"
  ).length;
  const submissionRate = workingDays > 0 ? Math.round((submittedCount / workingDays) * 100) : 0;

  // Delta vs previous week
  const thisWeekEntries = allEntries.filter(
    (e: { date: Date; status: string }) => new Date(e.date) >= thisWeekStart && new Date(e.date) <= thisWeekEnd
  );
  const lastWeekEntries = allEntries.filter(
    (e: { date: Date; status: string }) => new Date(e.date) >= lastWeekStart && new Date(e.date) <= lastWeekEnd
  );
  const thisWeekDays = countWeekdays(thisWeekStart, rateEnd);
  const lastWeekDays = countWeekdays(lastWeekStart, lastWeekEnd);
  const thisWeekRate = thisWeekDays > 0
    ? Math.round((thisWeekEntries.filter((e: { status: string }) => e.status !== "DRAFT" && e.status !== "MISSED").length / thisWeekDays) * 100)
    : 0;
  const lastWeekRate = lastWeekDays > 0
    ? Math.round((lastWeekEntries.filter((e: { status: string }) => e.status !== "DRAFT" && e.status !== "MISSED").length / lastWeekDays) * 100)
    : 0;

  // Support needs this week (proxy for "support meetings")
  const thisWeekEntryIds = await d.standupEntry.findMany({
    where: { userId: session.user.id, date: { gte: thisWeekStart, lte: thisWeekEnd } },
    select: { id: true },
  });
  const entryIds = thisWeekEntryIds.map((e: { id: string }) => e.id);
  const supportCount = entryIds.length > 0
    ? await d.standupSupportNeed.count({ where: { entryId: { in: entryIds } } })
    : 0;

  // Resolved blockers this week
  const resolvedCount = entryIds.length > 0
    ? await d.standupBlocker.count({ where: { entryId: { in: entryIds }, resolved: true } })
    : 0;

  return {
    submissionRate,
    submissionRateDelta: thisWeekRate - lastWeekRate,
    supportMeetingsCount: supportCount,
    resolvedBlockers: resolvedCount,
  };
}

/** Workspace note for a specific user — used by managers to read a member's note on the review page. */
export async function getMemberWorkspaceNote(userId: string): Promise<WorkspaceNoteData | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const note = await (db as any).dsmWorkspaceNote.findUnique({
    where: { ownerId: userId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      actionItems: { orderBy: { order: "asc" } },
    },
  });
  return note as WorkspaceNoteData | null;
}

/** All users for @mention support. */
export async function getTeamMembers(): Promise<TeamMember[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = await (db as any).user.findMany({
    select: { id: true, name: true, email: true, title: true, role: true },
    orderBy: { name: "asc" },
  });

  return users as TeamMember[];
}

/**
 * Unresolved blockers from the most recent *submitted* entry before today.
 * Carrying these forward helps members keep track of ongoing blocker status.
 */
export async function getYesterdayBlockers(): Promise<{ text: string; priority: "LOW" | "MEDIUM" | "HIGH"; mentionedUserId?: string | null }[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const today = toUtcDate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const entry = await d.standupEntry.findFirst({
    where: {
      userId: session.user.id,
      date: { lt: today },
      status: { in: ["SUBMITTED", "PENDING_REVIEW", "REVIEWED"] },
    },
    include: { blockers: { where: { resolved: false } } },
    orderBy: { date: "desc" },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (entry?.blockers ?? []).map((b: any) => ({
    text: b.text,
    priority: b.priority as "LOW" | "MEDIUM" | "HIGH",
    mentionedUserId: b.mentionedUserId,
  }));
}

// ── Internal helper ───────────────────────────────────────────────────────────

function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export type SharedNoteData = {
  id: string;
  title?: string | null;
  content: string;
  color: string | null;
  deadline: Date | null;
  createdAt: Date;
  threadTitle: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  canEdit: boolean;
  checklistItems: { id: string; text: string; checked: boolean }[];
};

export type SharedThreadData = {
  id: string;
  title: string;
  authorName: string;
  notes: {
    id: string;
    title?: string | null;
    content: string;
    color: string | null;
    deadline: Date | null;
    createdAt: Date;
    authorName: string;
    checklistItems: { id: string; text: string; checked: boolean }[];
  }[];
};

export async function isUserInAnyTeam(userId?: string): Promise<boolean> {
  const session = await auth();
  const id = userId || session?.user?.id;
  if (!id) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const count = await d.team.count({
    where: {
      OR: [
        { leadId: id },
        { members: { some: { userId: id } } },
      ],
    },
  });
  return count > 0;
}

export async function getSharedWorkspaceNotes(targetUserId?: string): Promise<{ notes: SharedNoteData[]; threads: SharedThreadData[] }> {
  const session = await auth();
  if (!session?.user?.id) return { notes: [], threads: [] };

  const viewerId = session.user.id;
  const viewerRole = session.user.role;
  const activeUserId = targetUserId || viewerId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // 1. Fetch Board Notes shared with or authored by the user — DSM boards only,
  // AND only notes cards that have actually been sent/shared.
  const sharedNotesRaw = await d.boardNote.findMany({
    where: {
      thread: { board: { type: "DSM" } },
      OR: [
        { shares: { some: { userId: activeUserId } } },
        { thread: { shares: { some: { userId: activeUserId } } } },
        {
          authorId: activeUserId,
          OR: [{ shares: { some: {} } }, { thread: { shares: { some: {} } } }],
        },
        {
          thread: { board: { ownerId: activeUserId } },
          OR: [{ shares: { some: {} } }, { thread: { shares: { some: {} } } }],
        },
      ],
    },
    include: {
      // Select the *viewer's* (session.user.id) share row for canEdit, not the
      // target member's — the person looking at the screen is who needs edit
      // rights, which may differ from activeUserId when a manager is reviewing
      // another member's workspace.
      thread: {
        select: {
          title: true,
          board: { select: { name: true } },
          shares: { where: { userId: viewerId }, select: { canEdit: true } },
        },
      },
      author: { select: { name: true, email: true, role: true } },
      checklistItems: { orderBy: { position: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notes: SharedNoteData[] = sharedNotesRaw.map((n: any) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    color: n.color,
    deadline: n.deadline,
    createdAt: n.createdAt,
    threadTitle: n.thread?.title ? `${n.thread.title} (${n.thread.board?.name || 'DSM Board'})` : "DSM Workspace",
    authorId: n.authorId,
    authorName: n.author.name || n.author.email.split("@")[0],
    authorRole: n.author.role,
    // Managers retain their existing blanket edit access over team members' DSM
    // notes (matches the pre-existing checklist-toggle permission model); everyone
    // else needs to be the author or hold an explicit edit-share grant.
    canEdit:
      viewerRole === "MANAGER" ||
      n.authorId === viewerId ||
      n.thread?.shares?.[0]?.canEdit === true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    checklistItems: n.checklistItems.map((c: any) => ({
      id: c.id,
      text: c.text,
      checked: c.checked,
    })),
  }));

  // 2. Fetch Threads shared with the user — DSM boards only
  const sharedThreadsRaw = await d.thread.findMany({
    where: {
      board: { type: "DSM" },
      shares: { some: { userId: activeUserId } }
    },
    include: {
      author: { select: { name: true, email: true } },
      notes: {
        include: {
          author: { select: { name: true, email: true } },
          checklistItems: { orderBy: { position: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      }
    },
    orderBy: { createdAt: "desc" },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const threads: SharedThreadData[] = sharedThreadsRaw.map((t: any) => ({
    id: t.id,
    title: t.title,
    authorName: t.author.name || t.author.email.split("@")[0],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    notes: t.notes.map((n: any) => ({
      id: n.id,
      content: n.content,
      color: n.color,
      deadline: n.deadline,
      createdAt: n.createdAt,
      authorName: n.author.name || n.author.email.split("@")[0],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      checklistItems: n.checklistItems.map((c: any) => ({
        id: c.id,
        text: c.text,
        checked: c.checked,
      })),
    })),
  }));

  return { notes, threads };
}
