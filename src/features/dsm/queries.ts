import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toUtcDate, getWeekRange } from "./utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EntryTask = {
  id: string;
  kind: "YESTERDAY" | "TODAY";
  text: string;
  order: number;
};

export type EntryBlocker = {
  id: string;
  text: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  resolved: boolean;
};

export type EntrySupportNeed = {
  id: string;
  text: string;
  mentionedUser: { id: string; name: string | null; email: string } | null;
  order: number;
};

export type EntryWithDetails = {
  id: string;
  date: Date;
  status: "DRAFT" | "SUBMITTED" | "PENDING_REVIEW" | "REVIEWED" | "MISSED";
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: { name: string | null; email: string } | null;
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
  blockers: true,
  supportNeeds: {
    orderBy: { order: "asc" },
    include: { mentionedUser: { select: { id: true, name: true, email: true } } },
  },
  reviewedBy: { select: { name: true, email: true } },
};

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

  return entry as EntryWithDetails | null;
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

  return entries as EntryWithDetails[];
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
export async function getKpiStats(): Promise<KpiStats> {
  const session = await auth();
  if (!session?.user?.id) {
    return { submissionRate: 0, submissionRateDelta: 0, supportMeetingsCount: 0, resolvedBlockers: 0 };
  }

  const now = new Date();
  const { start: thisWeekStart, end: thisWeekEnd } = getWeekRange(0, now);
  const { start: lastWeekStart, end: lastWeekEnd } = getWeekRange(-1, now);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Submission rate = submitted+reviewed entries / weekdays in last 4 weeks
  const fourWeeksAgo = new Date(now);
  fourWeeksAgo.setDate(now.getDate() - 28);

  const allEntries = await d.standupEntry.findMany({
    where: { userId: session.user.id, date: { gte: fourWeeksAgo } },
    select: { status: true, date: true },
  });

  const workingDays = countWeekdays(fourWeeksAgo, now);
  const submittedCount = allEntries.filter(
    (e: { status: string }) => e.status !== "DRAFT" && e.status !== "MISSED"
  ).length;
  const submissionRate = workingDays > 0 ? Math.round((submittedCount / workingDays) * 100) : 0;

  // Delta vs last week
  const thisWeekEntries = allEntries.filter(
    (e: { date: Date; status: string }) => new Date(e.date) >= thisWeekStart && new Date(e.date) <= thisWeekEnd
  );
  const lastWeekEntries = allEntries.filter(
    (e: { date: Date; status: string }) => new Date(e.date) >= lastWeekStart && new Date(e.date) <= lastWeekEnd
  );
  const thisWeekDays = countWeekdays(thisWeekStart, now);
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

/** All users (excluding the session user) for @mention support. */
export async function getTeamMembers(): Promise<TeamMember[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = await (db as any).user.findMany({
    where: { id: { not: session.user.id } },
    select: { id: true, name: true, email: true, title: true, role: true },
    orderBy: { name: "asc" },
  });

  return users as TeamMember[];
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
