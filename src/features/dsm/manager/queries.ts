import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toUtcDate, toIsoDateStr, getWeekRange, getTeamRank, sortTeamGroups, sortTeamMembers } from "../utils";
import { entriesWithLinkedDueDates } from "../due-date-sync";
import { isFullDayLeave } from "./leave-utils";

export { getTeamRank, sortTeamGroups, sortTeamMembers };

// ── Types ─────────────────────────────────────────────────────────────────────

export type MemberSubmissionCard = {
  userId: string;
  name: string | null;
  email: string;
  image?: string | null;
  title: string | null;
  entryId: string | null;
  status: "SUBMITTED" | "PENDING_REVIEW" | "REVIEWED" | "DRAFT" | "MISSED" | null;
  submittedAt: Date | null;
  todayTasks: { text: string; priority: string | null; managerPriority: string | null }[];
  blockerCount: number;
  supportCount: number;
  /** Approved (or pending) leave covering the selected day, if any. */
  leave: MemberLeaveInfo | null;
};

export type MemberLeaveInfo = {
  typeName: string;
  status: "APPROVED" | "PENDING";
  durationType: "FULL_DAY" | "HALF_DAY" | "QUARTER_DAY" | "EARLY_LEAVE" | "HOURLY";
  halfDayType: "FIRST_HALF" | "SECOND_HALF" | null;
  fromTime: string | null;
  toTime: string | null;
};

export type UpcomingLeave = MemberLeaveInfo & {

  
  id: string;
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  /** "YYYY-MM-DD" */
  fromDate: string;
  /** "YYYY-MM-DD" */
  toDate: string;
  durationDays: number;
};

type LeaveRow = {
  id: string;
  userId: string;
  status: "APPROVED" | "PENDING";
  durationType: MemberLeaveInfo["durationType"];
  halfDayType: MemberLeaveInfo["halfDayType"];
  fromTime: string | null;
  toTime: string | null;
  fromDate: Date;
  toDate: Date;
  durationDays: number;
  leaveType: { name: string };
};

function toLeaveInfo(l: LeaveRow): MemberLeaveInfo {
  return {
    typeName: l.leaveType.name,
    status: l.status,
    durationType: l.durationType,
    halfDayType: l.halfDayType,
    fromTime: l.fromTime,
    toTime: l.toTime,
  };
}

/** Approved / pending leave covering `day` (UTC midnight) per user — approved wins over pending. */
async function getLeavesOn(userIds: string[], day: Date): Promise<Map<string, MemberLeaveInfo>> {
  const out = new Map<string, MemberLeaveInfo>();
  if (userIds.length === 0) return out;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: LeaveRow[] = await (db as any).leaveRequest.findMany({
    where: {
      userId: { in: userIds },
      status: { in: ["APPROVED", "PENDING"] },
      fromDate: { lte: day },
      toDate: { gte: day },
    },
    select: {
      id: true,
      userId: true,
      status: true,
      durationType: true,
      halfDayType: true,
      fromTime: true,
      toTime: true,
      fromDate: true,
      toDate: true,
      durationDays: true,
      leaveType: { select: { name: true } },
    },
  });
  for (const l of rows) {
    const prev = out.get(l.userId);
    if (!prev || (prev.status === "PENDING" && l.status === "APPROVED")) out.set(l.userId, toLeaveInfo(l));
  }
  return out;
}

/**
 * Approved and pending leave of team members from `from` (UTC midnight, inclusive) over the next
 * `days` days — for the "Upcoming leaves" list on All DSM. Sorted by start date.
 */
export async function getUpcomingLeaves(from?: Date, days = 30): Promise<UpcomingLeave[]> {
  const managerId = await requireManager();
  if (!managerId) return [];
  const start = toUtcDate(from ?? new Date());
  const end = new Date(start.getTime() + days * 86_400_000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const memberships: { userId: string }[] = await d.teamMember.findMany({ select: { userId: true } });
  const userIds = Array.from(new Set(memberships.map((m) => m.userId)));
  if (userIds.length === 0) return [];
  const rows: (LeaveRow & { user: { name: string | null; email: string; image: string | null } })[] =
    await d.leaveRequest.findMany({
      where: {
        userId: { in: userIds },
        status: { in: ["APPROVED", "PENDING"] },
        toDate: { gte: start },
        fromDate: { lte: end },
      },
      select: {
        id: true,
        userId: true,
        status: true,
        durationType: true,
        halfDayType: true,
        fromTime: true,
        toTime: true,
        fromDate: true,
        toDate: true,
        durationDays: true,
        leaveType: { select: { name: true } },
        user: { select: { name: true, email: true, image: true } },
      },
      orderBy: [{ fromDate: "asc" }, { createdAt: "asc" }],
    });
  return rows.map((l) => ({
    ...toLeaveInfo(l),
    id: l.id,
    userId: l.userId,
    name: l.user.name,
    email: l.user.email,
    image: l.user.image,
    fromDate: toIsoDateStr(l.fromDate),
    toDate: toIsoDateStr(l.toDate),
    durationDays: l.durationDays,
  }));
}

export type TeamGroup = {
  teamId: string;
  teamName: string;
  department: string | null;
  totalMembers: number;
  submittedCount: number;
  members: MemberSubmissionCard[];
};

export type AllDsmStats = {
  totalSubmitted: number;
  totalExpected: number;
  pendingCount: number;
  blockerCount: number;
  pendingReviewCount: number;
  supportNeededCount: number;
  /** No live data source yet — always 0 until an overtime feature exists. */
  pendingOtCount: number;
};

export type TeamWithMembers = {
  id: string;
  name: string;
  department: string | null;
  description: string | null;
  requireApproval: boolean;
  notifyMembers: boolean;
  allowEdits: boolean;
  leadId: string | null;
  lead: { id: string; name: string | null; email: string; title: string | null } | null;
  members: { id: string; userId: string; user: { id: string; name: string | null; email: string; title: string | null } }[];
};

export type MemberReview = {
  user: { id: string; name: string | null; email: string; title: string | null };
  entries: MemberReviewEntry[];
};

export type MemberReviewEntry = {
  id: string;
  date: Date;
  status: "DRAFT" | "SUBMITTED" | "PENDING_REVIEW" | "REVIEWED" | "MISSED";
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: { name: string | null; email: string } | null;
  reviewComment: string | null;
  learningText: string | null;
  tasks: {
    id: string;
    kind: "YESTERDAY" | "TODAY";
    text: string;
    order: number;
    priority?: string | null;
    managerPriority: string | null;
    addedAfterReview?: boolean;
    isCompleted?: boolean;
    createdAt: Date;
    updatedAt: Date;
    projectTaskId?: string | null;
    recurringTaskId?: string | null;
    recurringTask?: { id: string; recurrenceRule: string; startDate: Date } | null;
    /** The task's own due date, set directly by the team member — independent of any linked project task. */
    dueDate?: Date | null;
    projectTask?: {
      id: string;
      code: string;
      title: string;
      status: string;
      ownerId?: string | null;
      owner?: string | null;
      owners?: { userId: string }[];
      project?: { id: string; name: string; code?: string | null; ownerId?: string | null; projectCategory?: string | null } | null;
    } | null;
    /** Project picked for the row — set even when no project task is linked. */
    projectId?: string | null;
    project?: { id: string; name: string } | null;
    addedBy?: { id: string; name: string | null; email: string; image?: string | null; role: "TEAM_MEMBER" | "MANAGER" } | null;
    editedBy?: { id: string; name: string | null; email: string; image?: string | null; role: "TEAM_MEMBER" | "MANAGER" } | null;
  }[];
  timelineEvents: { id: string; type: string; label: string; occurredAt: Date }[];
  blockers: { id: string; text: string; priority: "LOW" | "MEDIUM" | "HIGH"; resolved: boolean; mentionedUserId?: string | null; mentionedUserIds?: string | null; mentionedUser?: { id: string; name: string | null; email: string } | null; mentionedUsers?: { id: string; name: string | null; email: string }[]; editedBy?: { id: string; name: string | null; email: string } | null }[];
  supportNeeds: {
    id: string;
    text: string;
    mentionedUserId?: string | null;
    mentionedUserIds?: string | null;
    mentionedUser: { id: string; name: string | null; email: string } | null;
    mentionedUsers?: { id: string; name: string | null; email: string }[];
    editedBy?: { id: string; name: string | null; email: string } | null;
    order: number;
    resolved?: boolean;
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
  }[];
};

export type AllUser = {
  id: string;
  name: string | null;
  email: string;
  title: string | null;
  role: "TEAM_MEMBER" | "MANAGER";
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function requireManager() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "MANAGER") return null;
  return session.user.id;
}

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

/** All DSM stat overview for today. */
export async function getAllDsmStats(date?: Date): Promise<AllDsmStats | null> {
  const managerId = await requireManager();
  if (!managerId) return null;

  const targetDate = toUtcDate(date ?? new Date());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const teamMemberships = await d.teamMember.findMany({
    select: { userId: true },
  });
  const memberIds = Array.from(
    new Set(teamMemberships.map((m: { userId: string }) => m.userId))
  );
  const totalExpected = memberIds.length;

  if (memberIds.length === 0) {
    return {
      totalSubmitted: 0,
      totalExpected: 0,
      pendingCount: 0,
      blockerCount: 0,
      pendingReviewCount: 0,
      supportNeededCount: 0,
      pendingOtCount: 0,
    };
  }

  const todayEntries = await d.standupEntry.findMany({
    where: {
      userId: { in: memberIds },
      date: targetDate,
    },
    select: {
      userId: true,
      status: true,
      blockers: { select: { resolved: true, priority: true } },
      supportNeeds: { select: { resolved: true } },
    },
  });

  const submittedEntries = todayEntries.filter(
    (e: { status: string }) =>
      e.status === "SUBMITTED" ||
      e.status === "PENDING_REVIEW" ||
      e.status === "REVIEWED"
  );

  const totalSubmitted = submittedEntries.length;
  // Members on approved full-day leave who haven't submitted aren't pending.
  const submittedIds = new Set(submittedEntries.map((e: { userId: string }) => e.userId));
  const leaves = await getLeavesOn(memberIds as string[], targetDate);
  const onLeaveNotSubmitted = (memberIds as string[]).filter((id) => !submittedIds.has(id) && isFullDayLeave(leaves.get(id))).length;
  const pendingCount = Math.max(0, totalExpected - totalSubmitted - onLeaveNotSubmitted);
  const blockerCount = todayEntries.reduce(
    (sum: number, e: { blockers: { resolved: boolean; priority: string }[] }) =>
      sum + e.blockers.filter((b) => !b.resolved).length,
    0
  );
  const pendingReviewCount = todayEntries.filter(
    (e: { status: string }) => e.status === "SUBMITTED" || e.status === "PENDING_REVIEW"
  ).length;
  const supportNeededCount = todayEntries.reduce(
    (sum: number, e: { supportNeeds: { resolved: boolean }[] }) =>
      sum + e.supportNeeds.filter((s) => !s.resolved).length,
    0
  );

  return {
    totalSubmitted,
    totalExpected,
    pendingCount,
    blockerCount,
    pendingReviewCount,
    supportNeededCount,
    pendingOtCount: 0,
  };
}

export type DsmStatMember = {
  userId: string;
  name: string | null;
  email: string;
  teamName: string;
  meta?: string;
};

/** Members with active blockers & support needs for DSM overview stats dropdowns. */
export async function getBlockerAndSupportNeedMembers(
  date?: Date
): Promise<{ blockerMembers: DsmStatMember[]; supportNeededMembers: DsmStatMember[] }> {
  const managerId = await requireManager();
  if (!managerId) return { blockerMembers: [], supportNeededMembers: [] };

  const targetDate = toUtcDate(date ?? new Date());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const teamMemberships = await d.teamMember.findMany({
    include: { team: { select: { name: true } } },
  });
  const memberIds = Array.from(new Set(teamMemberships.map((m: { userId: string }) => m.userId)));
  if (memberIds.length === 0) return { blockerMembers: [], supportNeededMembers: [] };

  const teamNameByUserId = new Map<string, string>(
    teamMemberships.map((tm: { userId: string; team: { name: string } }) => [tm.userId, tm.team.name])
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

  const blockerMembers: DsmStatMember[] = [];
  for (const [userId, data] of blockerMap.entries()) {
    const entry = standupEntries.find((e: { userId: string }) => e.userId === userId);
    if (!entry) continue;
    const meta = data.texts.length === 1
      ? data.texts[0]
      : `${data.texts.length} blockers: ${data.texts.join(" • ")}`;
    blockerMembers.push({
      userId: entry.user.id,
      name: entry.user.name,
      email: entry.user.email,
      teamName: teamNameByUserId.get(entry.user.id) ?? "Unassigned",
      meta,
    });
  }

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

  const supportNeededMembers: DsmStatMember[] = [];
  for (const [userId, data] of supportMap.entries()) {
    const entry = standupEntries.find((e: { userId: string }) => e.userId === userId);
    if (!entry) continue;
    const meta = data.texts.length === 1
      ? data.texts[0]
      : `${data.texts.length} support needs: ${data.texts.join(" • ")}`;
    supportNeededMembers.push({
      userId: entry.user.id,
      name: entry.user.name,
      email: entry.user.email,
      teamName: teamNameByUserId.get(entry.user.id) ?? "Unassigned",
      meta,
    });
  }

  return { blockerMembers, supportNeededMembers };
}

/** Team-grouped DSM submissions for today. */
export async function getTeamDsmGroups(date?: Date): Promise<TeamGroup[]> {
  const managerId = await requireManager();
  if (!managerId) return [];

  const targetDate = toUtcDate(date ?? new Date());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const teams = await d.team.findMany({
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, title: true, image: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const allMemberIds = Array.from(
    new Set<string>(teams.flatMap((t: { members: { user: { id: string } }[] }) => t.members.map((m) => m.user.id)))
  );
  const leavesByUser = await getLeavesOn(allMemberIds, targetDate);

  const groups: TeamGroup[] = [];

  for (const team of teams) {
    const memberUserIds = team.members.map((m: { user: { id: string } }) => m.user.id);

    const entries = memberUserIds.length > 0
      ? await d.standupEntry.findMany({
        where: { userId: { in: memberUserIds }, date: targetDate },
        include: {
          tasks: { where: { kind: "TODAY" }, orderBy: { order: "asc" } },
          blockers: true,
          supportNeeds: true,
        },
      })
      : [];

    const entryByUserId = new Map(
      entries.map((e: { userId: string }) => [e.userId, e])
    );

    const cards: MemberSubmissionCard[] = team.members.map(
      (m: { user: { id: string; name: string | null; email: string; title: string | null; image?: string | null } }) => {
        const entry = entryByUserId.get(m.user.id) as {
          id: string;
          status: string;
          submittedAt: Date | null;
          tasks: { text: string; priority: string | null; managerPriority: string | null }[];
          blockers: unknown[];
          supportNeeds: unknown[];
        } | undefined;

        const isSubmitted =
          entry?.status === "SUBMITTED" ||
          entry?.status === "PENDING_REVIEW" ||
          entry?.status === "REVIEWED";

        return {
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image || null,
          title: m.user.title,
          entryId: entry?.id ?? null,
          status: (entry?.status as MemberSubmissionCard["status"]) ?? null,
          submittedAt: entry?.submittedAt ?? null,
          todayTasks: isSubmitted ? entry!.tasks.map((t) => ({ text: t.text, priority: t.priority, managerPriority: t.managerPriority })) : [],
          blockerCount: isSubmitted ? (entry!.blockers as unknown[]).length : 0,
          supportCount: isSubmitted ? (entry!.supportNeeds as unknown[]).length : 0,
          leave: leavesByUser.get(m.user.id) ?? null,
        };
      }
    );

    const submittedCount = cards.filter(
      (c) =>
        c.status === "SUBMITTED" ||
        c.status === "PENDING_REVIEW" ||
        c.status === "REVIEWED"
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

/** Full review data for a specific team member (current week or offset). */
export async function getMemberReview(
  memberId: string,
  weekOffset = 0
): Promise<MemberReview | null> {
  const managerId = await requireManager();
  if (!managerId) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const user = await d.user.findUnique({
    where: { id: memberId },
    select: { id: true, name: true, email: true, title: true },
  });
  if (!user) return null;

  const { start, end } = getWeekRange(weekOffset);
  const extendedStart = new Date(start);
  extendedStart.setDate(extendedStart.getDate() - 7);

  const entriesRaw = await d.standupEntry.findMany({
    where: { userId: memberId, date: { gte: extendedStart, lte: end } },
    include: {
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
              dueDate: true, // shared with the DSM row's due date (due-date-sync.ts)
              ownerId: true,
              owner: true,
              owners: { select: { userId: true } },
              project: { select: { id: true, name: true, code: true, ownerId: true, projectCategory: true } },
            },
          },
          project: { select: { id: true, name: true } },
          recurringTask: { select: { id: true, recurrenceRule: true, startDate: true } },
        },
      },
      blockers: {
        include: {
          mentionedUser: { select: { id: true, name: true, email: true } },
          editedBy: { select: { id: true, name: true, email: true } },
        }
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
    },
    orderBy: { date: "desc" },
  });

  const todayUtc = toUtcDate(new Date());
  const hasTodayEntry = entriesRaw.some((e: { date: Date }) => toUtcDate(e.date).getTime() === todayUtc.getTime());

  if (!hasTodayEntry && weekOffset === 0) {
    try {
      const newTodayEntry = await d.standupEntry.create({
        data: {
          userId: memberId,
          date: todayUtc,
          status: "DRAFT",
        },
        include: {
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
              dueDate: true, // shared with the DSM row's due date (due-date-sync.ts)
              ownerId: true,
              owner: true,
              owners: { select: { userId: true } },
              project: { select: { id: true, name: true, code: true, ownerId: true, projectCategory: true } },
            },
          },
          project: { select: { id: true, name: true } },
        },
      },
          blockers: {
            include: {
              mentionedUser: { select: { id: true, name: true, email: true } },
              editedBy: { select: { id: true, name: true, email: true } },
            }
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
        },
      });
      entriesRaw.unshift(newTodayEntry);
    } catch {
      // Ignore if concurrent creation or DB error
    }
  }

  const entries = entriesWithLinkedDueDates(await attachMentionedUsers(entriesRaw));

  return { user, entries: entries as MemberReviewEntry[] };
}

/** All teams with their lead and members. */
export async function getAllTeams(): Promise<TeamWithMembers[]> {
  const managerId = await requireManager();
  if (!managerId) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const teams = await d.team.findMany({
    include: {
      lead: { select: { id: true, name: true, email: true, title: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, title: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return sortTeamGroups(teams as TeamWithMembers[]);
}

/** All users for team-member picker. */
export async function getAllUsers(): Promise<AllUser[]> {
  const managerId = await requireManager();
  if (!managerId) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = await (db as any).user.findMany({
    select: { id: true, name: true, email: true, title: true, role: true },
    orderBy: { name: "asc" },
  });
  return users as AllUser[];
}
