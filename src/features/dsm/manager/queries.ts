import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toUtcDate, getWeekRange } from "../utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MemberSubmissionCard = {
  userId: string;
  name: string | null;
  email: string;
  title: string | null;
  entryId: string | null;
  status: "SUBMITTED" | "PENDING_REVIEW" | "REVIEWED" | "DRAFT" | "MISSED" | null;
  submittedAt: Date | null;
  todayTasks: string[];
  blockerCount: number;
  supportCount: number;
};

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
  projectStatus: "On Track" | "At Risk" | "Needs Attention";
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
  tasks: { id: string; kind: "YESTERDAY" | "TODAY"; text: string; order: number; managerPriority: "P1" | "P2" | "P3" | null }[];
  blockers: { id: string; text: string; priority: "LOW" | "MEDIUM" | "HIGH"; resolved: boolean; mentionedUser?: { name: string | null; email: string } | null }[];
  supportNeeds: { id: string; text: string; mentionedUser: { name: string | null; email: string } | null; order: number }[];
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
      projectStatus: "On Track",
    };
  }

  const todayEntries = await d.standupEntry.findMany({
    where: {
      userId: { in: memberIds },
      date: targetDate,
    },
    select: { status: true, blockers: { select: { resolved: true, priority: true } } },
  });

  const submittedEntries = todayEntries.filter(
    (e: { status: string }) =>
      e.status === "SUBMITTED" ||
      e.status === "PENDING_REVIEW" ||
      e.status === "REVIEWED"
  );

  const totalSubmitted = submittedEntries.length;
  const pendingCount = Math.max(0, totalExpected - totalSubmitted);
  const blockerCount = todayEntries.reduce(
    (sum: number, e: { blockers: { resolved: boolean; priority: string }[] }) =>
      sum + e.blockers.filter((b) => !b.resolved).length,
    0
  );

  const projectStatus: AllDsmStats["projectStatus"] =
    blockerCount > 1 ? "Needs Attention"
      : blockerCount === 1 ? "At Risk"
        : pendingCount > 0 ? "At Risk"
          : "On Track";

  return { totalSubmitted, totalExpected, pendingCount, blockerCount, projectStatus };
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
            select: { id: true, name: true, email: true, title: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

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
      (m: { user: { id: string; name: string | null; email: string; title: string | null } }) => {
        const entry = entryByUserId.get(m.user.id) as {
          id: string;
          status: string;
          submittedAt: Date | null;
          tasks: { text: string }[];
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
          title: m.user.title,
          entryId: entry?.id ?? null,
          status: (entry?.status as MemberSubmissionCard["status"]) ?? null,
          submittedAt: entry?.submittedAt ?? null,
          todayTasks: isSubmitted ? entry!.tasks.map((t) => t.text) : [],
          blockerCount: isSubmitted ? (entry!.blockers as unknown[]).length : 0,
          supportCount: isSubmitted ? (entry!.supportNeeds as unknown[]).length : 0,
        };
      }
    );

    const submittedCount = cards.filter(
      (c) =>
        c.status === "SUBMITTED" ||
        c.status === "PENDING_REVIEW" ||
        c.status === "REVIEWED"
    ).length;

    groups.push({
      teamId: team.id,
      teamName: team.name,
      department: team.department,
      totalMembers: team.members.length,
      submittedCount,
      members: cards,
    });
  }

  return groups;
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

  const entries = await d.standupEntry.findMany({
    where: { userId: memberId, date: { gte: start, lte: end } },
      include: {
        tasks: { orderBy: { order: "asc" } },
        blockers: {
          include: { mentionedUser: { select: { name: true, email: true } } }
        },
        supportNeeds: {
          orderBy: { order: "asc" },
          include: { mentionedUser: { select: { name: true, email: true } } },
        },
        reviewedBy: { select: { name: true, email: true } },
      },
    orderBy: { date: "desc" },
  });

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

  return teams as TeamWithMembers[];
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
