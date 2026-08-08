import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toUtcDate, getWeekRange } from "@/features/dsm/utils";
import { sortTeamMembers, sortTeamGroups } from "@/features/dsm/manager/queries";
import type { DsrEntryData } from "../queries";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DsrMemberCard = {
  userId: string;
  name: string | null;
  email: string;
  title: string | null;
  entryId: string | null;
  status: "SUBMITTED" | "PENDING_REVIEW" | "REVIEWED" | "DRAFT" | "MISSED" | null;
  submittedAt: Date | null;
  resultOfDay: string | null;
  completedTaskCount: number;
  plannedTaskCount: number;
};

export type DsrTeamGroup = {
  teamId: string;
  teamName: string;
  department: string | null;
  totalMembers: number;
  submittedCount: number;
  members: DsrMemberCard[];
};

export type AllDsrStats = {
  totalSubmitted: number;
  totalExpected: number;
  pendingCount: number;
  highPriorityBlockers: number;
  projectStatus: "On Track" | "At Risk" | "Needs Attention";
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function requireManager(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") return null;
  return session.user.id;
}

const dsrInclude = {
  plannedTasks: { orderBy: { order: "asc" } },
  additionalWorks: { orderBy: { order: "asc" } },
  resolvedBlockers: { orderBy: { order: "asc" } },
  followUpsDone: { orderBy: { order: "asc" } },
  learningItems: { orderBy: { order: "asc" } },
  timelineEvents: { orderBy: { occurredAt: "asc" } },
  reviewedBy: { select: { name: true, email: true } },
};

// ── Queries ───────────────────────────────────────────────────────────────────

/** Top stat cards for the All Team DSR overview. */
export async function getAllDsrStats(date?: Date): Promise<AllDsrStats | null> {
  const managerId = await requireManager();
  if (!managerId) return null;

  const targetDate = toUtcDate(date ?? new Date());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const allMembers = await d.user.findMany({
    where: { role: "TEAM_MEMBER" },
    select: { id: true },
  });
  const memberIds = allMembers.map((u: { id: string }) => u.id);
  const totalExpected = memberIds.length;

  const todayEntries = await d.dsrEntry.findMany({
    where: { userId: { in: memberIds }, date: targetDate },
    select: { status: true, userId: true },
  });

  const submittedEntries = todayEntries.filter(
    (e: { status: string }) =>
      e.status === "SUBMITTED" || e.status === "PENDING_REVIEW" || e.status === "REVIEWED"
  );
  const totalSubmitted = submittedEntries.length;
  const pendingCount = totalExpected - totalSubmitted;

  // High-priority unresolved blockers from DSM (StandupBlocker)
  const standupEntryIds = await d.standupEntry.findMany({
    where: { userId: { in: memberIds }, date: targetDate },
    select: { id: true },
  });
  const eIds = standupEntryIds.map((e: { id: string }) => e.id);
  const highPriorityBlockers = eIds.length > 0
    ? await d.standupBlocker.count({
        where: { entryId: { in: eIds }, priority: "HIGH", resolved: false },
      })
    : 0;

  const projectStatus: AllDsrStats["projectStatus"] =
    highPriorityBlockers > 1 ? "Needs Attention"
    : highPriorityBlockers === 1 ? "At Risk"
    : pendingCount > 0 ? "At Risk"
    : "On Track";

  return { totalSubmitted, totalExpected, pendingCount, highPriorityBlockers, projectStatus };
}

/** Team-grouped DSR submissions for a given date. */
export async function getTeamGroupedDsrSubmissions(date?: Date): Promise<DsrTeamGroup[]> {
  const managerId = await requireManager();
  if (!managerId) return [];

  const targetDate = toUtcDate(date ?? new Date());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const teams = await d.team.findMany({
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, title: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const groups: DsrTeamGroup[] = [];

  for (const team of teams) {
    const memberUserIds = team.members.map((m: { user: { id: string } }) => m.user.id);

    const entries = memberUserIds.length > 0
      ? await d.dsrEntry.findMany({
          where: { userId: { in: memberUserIds }, date: targetDate },
          select: {
            id: true, userId: true, status: true, submittedAt: true,
            resultOfDay: true, completedTaskCount: true, plannedTaskCount: true,
          },
        })
      : [];

    const entryByUserId = new Map(entries.map((e: { userId: string }) => [e.userId, e]));

    const cards: DsrMemberCard[] = team.members.map(
      (m: { user: { id: string; name: string | null; email: string; title: string | null } }) => {
        const entry = entryByUserId.get(m.user.id) as {
          id: string; status: string; submittedAt: Date | null;
          resultOfDay: string | null; completedTaskCount: number; plannedTaskCount: number;
        } | undefined;

        return {
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          title: m.user.title,
          entryId: entry?.id ?? null,
          status: (entry?.status as DsrMemberCard["status"]) ?? null,
          submittedAt: entry?.submittedAt ?? null,
          resultOfDay: entry?.resultOfDay ?? null,
          completedTaskCount: entry?.completedTaskCount ?? 0,
          plannedTaskCount: entry?.plannedTaskCount ?? 0,
        };
      }
    );

    const submittedCount = cards.filter(
      (c) => c.status === "SUBMITTED" || c.status === "PENDING_REVIEW" || c.status === "REVIEWED"
    ).length;

    const sortedCards = sortTeamMembers(cards, team.name);

    groups.push({
      teamId: team.id,
      teamName: team.name,
      department: team.department,
      totalMembers: team.members.length,
      submittedCount,
      members: sortedCards,
    });
  }

  return sortTeamGroups(groups);
}

/** Full DSR review data for a specific member (current week or offset). */
export type MemberDsrReview = {
  user: { id: string; name: string | null; email: string; title: string | null };
  todayEntry: DsrEntryData | null;
  weekEntries: DsrEntryData[];
  todayDsmReviewed: boolean;
};

export async function getMemberDsrReview(
  memberId: string,
  weekOffset = 0
): Promise<MemberDsrReview | null> {
  const managerId = await requireManager();
  if (!managerId) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const user = await d.user.findUnique({
    where: { id: memberId },
    select: { id: true, name: true, email: true, title: true },
  });
  if (!user) return null;

  const today = toUtcDate();
  const { start, end } = getWeekRange(weekOffset);

  const todayEntry = await d.dsrEntry.findUnique({
    where: { userId_date: { userId: memberId, date: today } },
    include: dsrInclude,
  });

  const weekEntries = await d.dsrEntry.findMany({
    where: { userId: memberId, date: { gte: start, lte: end } },
    include: dsrInclude,
    orderBy: { date: "desc" },
  });

  const todayStandup = await d.standupEntry.findUnique({
    where: { userId_date: { userId: memberId, date: today } },
    select: { status: true },
  });

  return {
    user,
    todayEntry: todayEntry as DsrEntryData | null,
    weekEntries: weekEntries as DsrEntryData[],
    todayDsmReviewed: todayStandup?.status === "REVIEWED",
  };
}
