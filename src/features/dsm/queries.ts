import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toUtcDate, getWeekRange } from "./utils";
import { decodeDescriptionWithTimePeriod } from "@/features/projects/utils/time-helpers";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EntryTask = {
  id: string;
  kind: "YESTERDAY" | "TODAY";
  text: string;
  order: number;
  priority?: string | null;
  managerPriority?: string | null;
  addedAfterReview?: boolean;
  projectTaskId?: string | null;
  isCompleted?: boolean;
  projectTask?: {
    id: string;
    code: string;
    title: string;
    status: string;
    completionPercentage: number;
    ownerId?: string | null;
    owner?: string | null;
    owners?: { userId: string }[];
    project?: { id: string; name: string; code?: string | null; ownerId?: string | null } | null;
  } | null;
  createdAt?: Date;
  updatedAt?: Date;
  addedBy?: { id: string; name: string | null; email: string; image?: string | null; role?: "TEAM_MEMBER" | "MANAGER" } | null;
  editedBy?: { id: string; name: string | null; email: string; image?: string | null; role?: "TEAM_MEMBER" | "MANAGER" } | null;
};

export type EntryTimelineEvent = {
  id: string;
  type: string;
  label: string;
  occurredAt: Date;
};

export type EntryBlocker = {
  id: string;
  text: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  resolved: boolean;
  mentionedUserId?: string | null;
  mentionedUserIds?: string | null;
  projectTaskId?: string | null;
  projectTask?: {
    id: string;
    code: string;
    title: string;
    status: string;
    ownerId?: string | null;
    owner?: string | null;
    owners?: { userId: string }[];
    project?: { id: string; name: string; code?: string | null; ownerId?: string | null } | null;
  } | null;
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
  eventId?: string | null;
  event?: {
    id: string;
    title: string;
    description: string | null;
    start: Date;
    end: Date;
    isAllDay: boolean;
    updatedAt: Date;
    organizer: { email: string } | null;
    attendees: { email: string; status: string }[];
  } | null;
};

export type EntryWithDetails = {
  id: string;
  date: Date;
  status: "DRAFT" | "SUBMITTED" | "PENDING_REVIEW" | "REVIEWED" | "MISSED";
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: { name: string | null; email: string } | null;
  user?: { id: string; name: string | null; email: string; image?: string | null; role?: "TEAM_MEMBER" | "MANAGER" } | null;
  learningText: string | null;
  tasks: EntryTask[];
  blockers: EntryBlocker[];
  supportNeeds: EntrySupportNeed[];
  timelineEvents: EntryTimelineEvent[];
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
  user: { select: { id: true, name: true, email: true, image: true, role: true } },
  tasks: {
    orderBy: { order: "asc" },
    include: {
      addedBy: { select: { id: true, name: true, email: true, image: true, role: true } },
      editedBy: { select: { id: true, name: true, email: true, image: true, role: true } },
      projectTask: {
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          completionPercentage: true,
          ownerId: true,
          owner: true,
          owners: { select: { userId: true } },
          project: { select: { id: true, name: true, code: true, ownerId: true } },
        },
      },
    },
  },
  blockers: {
    include: {
      mentionedUser: { select: { id: true, name: true, email: true } },
      editedBy: { select: { id: true, name: true, email: true } },
      projectTask: {
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          ownerId: true,
          owner: true,
          owners: { select: { userId: true } },
          project: { select: { id: true, name: true, code: true, ownerId: true } },
        },
      },
    },
  },
  supportNeeds: {
    orderBy: { order: "asc" },
    include: {
      mentionedUser: { select: { id: true, name: true, email: true } },
      editedBy: { select: { id: true, name: true, email: true } },
      event: {
        select: {
          id: true,
          title: true,
          description: true,
          start: true,
          end: true,
          isAllDay: true,
          updatedAt: true,
          organizer: { select: { email: true } },
          attendees: { select: { email: true, status: true } },
        },
      },
    },
  },
  reviewedBy: { select: { name: true, email: true } },
  timelineEvents: { orderBy: { occurredAt: "asc" } },
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

  if (!entry || !entry.blockers || entry.blockers.length === 0) return [];

  // Check if DSR exists for that date and if any blocker was marked resolved in DSR
  const dsr = await d.dsrEntry.findUnique({
    where: { userId_date: { userId: session.user.id, date: entry.date } },
    include: { resolvedBlockers: { select: { text: true, resolved: true } } },
  });

  const resolvedInDsrTexts = new Set(
    (dsr?.resolvedBlockers ?? [])
      .filter((rb: { resolved: boolean }) => rb.resolved)
      .map((rb: { text: string }) => rb.text.trim().toLowerCase())
  );

  return (entry.blockers ?? [])
    .filter((b: { resolved: boolean; text: string; priority: string; mentionedUserId?: string | null }) => !b.resolved && !resolvedInDsrTexts.has(b.text.trim().toLowerCase()))
    .map((b: { text: string; priority: string; mentionedUserId?: string | null }) => ({
      text: b.text,
      priority: b.priority as "LOW" | "MEDIUM" | "HIGH",
      mentionedUserId: b.mentionedUserId,
    }));
}

/**
 * Unresolved support needs from the most recent *submitted* entry before today.
 * Carrying these forward mirrors getYesterdayBlockers() for the support-needed section.
 */
export async function getYesterdaySupportNeeds(): Promise<{ text: string; mentionedUserId?: string | null }[]> {
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
    include: { supportNeeds: { where: { resolved: false } } },
    orderBy: { date: "desc" },
  });

  if (!entry || !entry.supportNeeds || entry.supportNeeds.length === 0) return [];

  // Check if DSR exists for that date and if any support need/follow-up was completed in DSR
  const dsr = await d.dsrEntry.findUnique({
    where: { userId_date: { userId: session.user.id, date: entry.date } },
    include: { followUpsDone: { select: { text: true, completed: true } } },
  });

  const completedInDsrTexts = new Set(
    (dsr?.followUpsDone ?? [])
      .filter((fu: { completed: boolean }) => fu.completed)
      .map((fu: { text: string }) => fu.text.trim().toLowerCase())
  );

  return (entry.supportNeeds ?? [])
    .filter((s: { resolved: boolean; text: string; mentionedUserId?: string | null }) => !s.resolved && !completedInDsrTexts.has(s.text.trim().toLowerCase()))
    .map((s: { text: string; mentionedUserId?: string | null }) => ({
      text: s.text,
      mentionedUserId: s.mentionedUserId,
    }));
}

/**
 * Yesterday's learning items that were NOT marked complete.
 * Completion state for a DSM learning item is recorded on that same day's evening
 * DsrEntry.learningItems (DsrLearningItem.completed), synced from StandupEntry.learningText
 * when the DSR is submitted. Mirrors getYesterdayIncompleteTasks() for the learning section.
 */
export async function getYesterdayIncompleteLearningItems(): Promise<string[]> {
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
    select: { date: true, learningText: true },
    orderBy: { date: "desc" },
  });

  const lines: string[] = entry?.learningText
    ? entry.learningText.split("\n").map((l: string) => l.trim()).filter(Boolean)
    : [];
  if (lines.length === 0) return [];

  const dsr = await d.dsrEntry.findUnique({
    where: { userId_date: { userId: session.user.id, date: entry.date } },
    include: { learningItems: { select: { text: true, completed: true } } },
  });

  if (!dsr) return lines;

  const completedTexts = new Set(
    (dsr.learningItems ?? [])
      .filter((l: { completed: boolean }) => l.completed)
      .map((l: { text: string }) => l.text.trim().toLowerCase())
  );

  return lines.filter((text) => !completedTexts.has(text.trim().toLowerCase()));
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

// ── Project Task Linkage Queries ──────────────────────────────────────────────

export type OpenProjectTaskOption = {
  id: string;
  code: string;
  title: string;
  status: string;
  completionPercentage: number;
  projectId: string | null;
  projectName: string | null;
};

export async function getUserOpenProjectTasks(userIdInput?: string): Promise<OpenProjectTaskOption[]> {
  let userId = userIdInput;
  if (!userId) {
    const session = await auth();
    userId = session?.user?.id;
  }
  if (!userId) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const tasks = await d.projectTask.findMany({
    where: {
      status: { notIn: ["Closed", "Closed/Done", "Completed"] },
      OR: [
        { ownerId: userId },
        { owners: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      completionPercentage: true,
      projectId: true,
      project: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tasks.map((t: any) => ({
    id: t.id,
    code: t.code,
    title: t.title,
    status: t.status,
    completionPercentage: t.completionPercentage,
    projectId: t.projectId,
    projectName: t.project?.name ?? null,
  }));
}

export type ProjectStandupRollupItem = {
  type: "TASK" | "BLOCKER";
  id: string;
  text: string;
  date: Date;
  user: { id: string; name: string | null; email: string; image?: string | null };
  taskCode: string;
  taskTitle: string;
  priority?: string | null;
  isCompleted?: boolean;
};

export async function getProjectStandupRollup(projectId: string): Promise<ProjectStandupRollupItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const standupTasks = await d.standupTask.findMany({
    where: {
      projectTask: { projectId },
      createdAt: { gte: sevenDaysAgo },
    },
    include: {
      entry: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
      projectTask: { select: { code: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const standupBlockers = await d.standupBlocker.findMany({
    where: {
      projectTask: { projectId },
      createdAt: { gte: sevenDaysAgo },
    },
    include: {
      entry: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
      projectTask: { select: { code: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const items: ProjectStandupRollupItem[] = [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...standupTasks.map((t: any) => ({
      type: "TASK" as const,
      id: t.id,
      text: t.text,
      date: t.entry?.date ?? t.createdAt,
      user: t.entry?.user,
      taskCode: t.projectTask?.code ?? "",
      taskTitle: t.projectTask?.title ?? "",
      priority: t.priority,
      isCompleted: t.isCompleted,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...standupBlockers.map((b: any) => ({
      type: "BLOCKER" as const,
      id: b.id,
      text: b.text,
      date: b.entry?.date ?? b.createdAt,
      user: b.entry?.user,
      taskCode: b.projectTask?.code ?? "",
      taskTitle: b.projectTask?.title ?? "",
      priority: b.priority,
    })),
  ];

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return items;
}

export async function getLinkedTimeLogsYesterday(
  userIdInput?: string,
  projectTaskIds?: string[]
): Promise<Record<string, number>> {
  let userId = userIdInput;
  if (!userId) {
    const session = await auth();
    userId = session?.user?.id;
  }
  if (!userId || !projectTaskIds || projectTaskIds.length === 0) return {};

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const endYesterday = new Date(yesterday);
  endYesterday.setHours(23, 59, 59, 999);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const timeLogs = await d.projectTimeLog.findMany({
    where: {
      userId,
      taskId: { in: projectTaskIds },
      date: { gte: yesterday, lte: endYesterday },
    },
    select: { taskId: true, duration: true },
  });

  const result: Record<string, number> = {};
  for (const log of timeLogs) {
    result[log.taskId] = (result[log.taskId] || 0) + log.duration;
  }
  return result;
}

export type DailyTimeSummary = {
  totalMinutes: number;
  firstStart: string | null;
  lastStop: string | null;
};

/**
 * Per-task total logged minutes plus first-start/last-stop times for a given user + calendar
 * day, decoded from `ProjectTimeLog.description`'s "[start - stop] remarks" encoding (see
 * `encodeDescriptionWithTimePeriod`). Reused by the Standup Card, Manager review, and DSR display
 * so "time spent" reads identically everywhere it's shown.
 */
export async function getDailyTimeSummaryForTasks(
  userId: string,
  taskIds: string[],
  date: Date
): Promise<Record<string, DailyTimeSummary>> {
  if (!userId || taskIds.length === 0) return {};

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const logs = await d.projectTimeLog.findMany({
    where: { userId, taskId: { in: taskIds }, date: { gte: dayStart, lte: dayEnd } },
    select: { taskId: true, duration: true, description: true },
    orderBy: { date: "asc" as const },
  });

  const result: Record<string, DailyTimeSummary> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const log of logs as any[]) {
    const { timePeriod } = decodeDescriptionWithTimePeriod(log.description);
    const [start, stop] = timePeriod
      ? timePeriod.split(/[-–]/).map((s: string) => s.trim())
      : [null, null];
    const existing: DailyTimeSummary = result[log.taskId] || {
      totalMinutes: 0,
      firstStart: null,
      lastStop: null,
    };
    existing.totalMinutes += log.duration;
    if (start && !existing.firstStart) existing.firstStart = start;
    if (stop) existing.lastStop = stop;
    result[log.taskId] = existing;
  }
  return result;
}

export type CascadingSubtaskOption = {
  id: string;
  code: string;
  title: string;
  status: string;
};

export type CascadingTaskOption = {
  id: string;
  code: string;
  title: string;
  status: string;
  subtasks: CascadingSubtaskOption[];
};

export type CascadingProjectOption = {
  id: string;
  code: string | null;
  name: string;
  tasks: CascadingTaskOption[];
};

export async function getUserProjectsWithTasksAndSubtasks(
  userIdInput?: string
): Promise<CascadingProjectOption[]> {
  let userId = userIdInput;
  if (!userId) {
    const session = await auth();
    userId = session?.user?.id;
  }
  if (!userId) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const projects = await d.project.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      code: true,
      name: true,
      tasks: {
        where: {
          status: { notIn: ["Closed", "Closed/Done", "Completed"] },
          parentTaskId: null,
          OR: [{ ownerId: userId }, { owners: { some: { userId } } }],
        },
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          childTasks: {
            where: {
              status: { notIn: ["Closed", "Closed/Done", "Completed"] },
              OR: [{ ownerId: userId }, { owners: { some: { userId } } }],
            },
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  type QuerySubtask = { id: string; code: string | null; title: string; status: string };
  type QueryTask = { id: string; code: string | null; title: string; status: string; childTasks?: QuerySubtask[] };
  type QueryProject = { id: string; code: string | null; name: string; tasks?: QueryTask[] };

  return (projects as QueryProject[]).map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    tasks: (p.tasks || []).map((t) => ({
      id: t.id,
      code: t.code,
      title: t.title,
      status: t.status,
      subtasks: (t.childTasks || []).map((st) => ({
        id: st.id,
        code: st.code,
        title: st.title,
        status: st.status,
      })),
    })),
  }));
}

