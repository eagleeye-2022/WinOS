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
  image?: string | null;
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
  /** All unresolved blockers (any priority) still open on this date. */
  blockersCount: number;
  /** Subset of blockersCount that are HIGH priority. */
  highPriorityBlockersCount: number;
  pendingReviewCount: number;
  supportNeededCount: number;
  /** No live data source yet — always 0 until an overtime feature exists. */
  pendingOtCount: number;
};

export type DsrStatMember = {
  id?: string;
  userId: string;
  name: string | null;
  email: string;
  teamName: string;
  meta?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function requireManager(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") return null;
  return session.user.id;
}

/**
 * Team-assigned TEAM_MEMBER user ids — the same universe the manage page's team
 * columns render. Every stat/dropdown on this page must scope to this exact set,
 * otherwise a card's count and its dropdown list can disagree (e.g. a manager's
 * own blocker, or a member with no team, showing in one but not the other).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getTeamScopedMemberIds(d: any): Promise<string[]> {
  const teamMembers = await d.teamMember.findMany({
    select: { userId: true },
  });
  return Array.from(new Set(teamMembers.map((tm: { userId: string }) => tm.userId))) as string[];
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

  const memberIds = await getTeamScopedMemberIds(d);
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
  const pendingReviewCount = todayEntries.filter(
    (e: { status: string }) => e.status === "SUBMITTED" || e.status === "PENDING_REVIEW"
  ).length;

  // Remaining (unresolved) blockers + open support needs from DSM (same-day standup entries)
  const standupEntries = await d.standupEntry.findMany({
    where: { userId: { in: memberIds }, date: targetDate },
    select: { id: true, userId: true },
  });
  const eIds = standupEntries.map((e: { id: string }) => e.id);

  const blockers = eIds.length > 0
    ? await d.standupBlocker.findMany({
        where: { entryId: { in: eIds }, resolved: false },
        select: { entryId: true, priority: true },
      })
    : [];

  const supportNeeds = eIds.length > 0
    ? await d.standupSupportNeed.findMany({
        where: { entryId: { in: eIds }, resolved: false },
        select: { entryId: true },
      })
    : [];

  // Member-grouped count for blockers, real total count for support needs
  const blockerMembersCount = new Set(blockers.map((b: { entryId: string }) => b.entryId)).size;
  const highPriorityBlockersCount = blockers.filter((b: { priority: string }) => b.priority === "HIGH").length;
  const realSupportNeededCount = supportNeeds.length;

  return {
    totalSubmitted,
    totalExpected,
    pendingCount,
    blockersCount: blockerMembersCount,
    highPriorityBlockersCount,
    pendingReviewCount,
    supportNeededCount: realSupportNeededCount,
    pendingOtCount: 0,
  };
}

/**
 * Members behind the "Blockers" and "Support Needed" stat cards, sourced from the same
 * team-scoped, same-day standup blockers/support-needs used to compute `blockersCount`
 * and `supportNeededCount` in getAllDsrStats — grouped by member for clean 1:1 card/dropdown alignment.
 */
export async function getBlockerAndSupportNeedMembers(
  date?: Date
): Promise<{ blockerMembers: DsrStatMember[]; supportNeededMembers: DsrStatMember[] }> {
  const managerId = await requireManager();
  if (!managerId) return { blockerMembers: [], supportNeededMembers: [] };

  const targetDate = toUtcDate(date ?? new Date());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const memberIds = await getTeamScopedMemberIds(d);

  const teamMembers = await d.teamMember.findMany({
    where: { userId: { in: memberIds } },
    include: { team: { select: { name: true } } },
  });
  const teamNameByUserId = new Map<string, string>(
    teamMembers.map((tm: { userId: string; team: { name: string } }) => [tm.userId, tm.team.name])
  );

  const standupEntries = await d.standupEntry.findMany({
    where: { userId: { in: memberIds }, date: targetDate },
    select: { id: true, userId: true, user: { select: { id: true, name: true, email: true } } },
  });
  const entryById = new Map(standupEntries.map((e: { id: string }) => [e.id, e]));
  const eIds = standupEntries.map((e: { id: string }) => e.id);

  if (eIds.length === 0) return { blockerMembers: [], supportNeededMembers: [] };

  const blockers = await d.standupBlocker.findMany({
    where: { entryId: { in: eIds }, resolved: false },
    select: { id: true, entryId: true, text: true, priority: true },
  });
  const supportNeeds = await d.standupSupportNeed.findMany({
    where: { entryId: { in: eIds }, resolved: false },
    select: { id: true, entryId: true, text: true },
  });

  // Group blockers by member
  const blockerMap = new Map<string, { id: string; texts: string[]; priority: string }>();
  for (const b of blockers) {
    const entry = entryById.get(b.entryId) as
      | { userId: string; user: { id: string; name: string | null; email: string } }
      | undefined;
    if (!entry) continue;
    const uid = entry.user.id;
    const bText = b.priority === "HIGH" ? `${b.text} (High)` : b.text;
    if (!blockerMap.has(uid)) {
      blockerMap.set(uid, { id: b.id, texts: [bText], priority: b.priority });
    } else {
      const existing = blockerMap.get(uid)!;
      existing.texts.push(bText);
      if (b.priority === "HIGH") existing.priority = "HIGH";
    }
  }

  const blockerMembers: DsrStatMember[] = [];
  for (const [userId, data] of blockerMap.entries()) {
    const entry = standupEntries.find((e: { userId: string }) => e.userId === userId);
    if (!entry) continue;
    const meta = data.texts.length === 1
      ? data.texts[0]
      : `${data.texts.length} blockers: ${data.texts.join(" • ")}`;
    blockerMembers.push({
      id: data.id,
      userId: entry.user.id,
      name: entry.user.name,
      email: entry.user.email,
      teamName: teamNameByUserId.get(entry.user.id) ?? "Unassigned",
      meta,
    });
  }

  // Group support needs by member
  const supportMap = new Map<string, { id: string; texts: string[] }>();
  for (const s of supportNeeds) {
    const entry = entryById.get(s.entryId) as
      | { userId: string; user: { id: string; name: string | null; email: string } }
      | undefined;
    if (!entry) continue;
    const uid = entry.user.id;
    if (!supportMap.has(uid)) {
      supportMap.set(uid, { id: s.id, texts: [s.text] });
    } else {
      supportMap.get(uid)!.texts.push(s.text);
    }
  }

  const supportNeededMembers: DsrStatMember[] = [];
  for (const [userId, data] of supportMap.entries()) {
    const entry = standupEntries.find((e: { userId: string }) => e.userId === userId);
    if (!entry) continue;
    const meta = data.texts.length === 1
      ? data.texts[0]
      : `${data.texts.length} requests: ${data.texts.join(" • ")}`;
    supportNeededMembers.push({
      id: data.id,
      userId: entry.user.id,
      name: entry.user.name,
      email: entry.user.email,
      teamName: teamNameByUserId.get(entry.user.id) ?? "Unassigned",
      meta,
    });
  }

  return { blockerMembers, supportNeededMembers };
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
          user: { select: { id: true, name: true, email: true, title: true, image: true } },
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
      (m: { user: { id: string; name: string | null; email: string; title: string | null; image?: string | null } }) => {
        const entry = entryByUserId.get(m.user.id) as {
          id: string; status: string; submittedAt: Date | null;
          resultOfDay: string | null; completedTaskCount: number; plannedTaskCount: number;
        } | undefined;

        return {
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image || null,
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
