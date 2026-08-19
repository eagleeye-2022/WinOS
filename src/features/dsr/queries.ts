import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toUtcDate, getWeekRange } from "./utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DsrPlannedTaskData = {
  id: string;
  text: string;
  priority: string | null;
  completed: boolean;
  order: number;
  addedAfterReview?: boolean;
};

export type DsrAdditionalWorkData = { id: string; text: string; order: number };
export type DsrResolvedBlockerData = { id: string; text: string; resolved: boolean; order: number };
export type DsrFollowUpDoneData = { id: string; text: string; completed: boolean; order: number };
export type DsrLearningItemData = { id: string; text: string; completed: boolean; order: number };
export type DsrTimelineEventData = { id: string; type: string; label: string; occurredAt: Date };

export type DsrEntryData = {
  id: string;
  date: Date;
  status: "DRAFT" | "SUBMITTED" | "PENDING_REVIEW" | "REVIEWED" | "MISSED";
  completionPercent: number;
  plannedTaskCount: number;
  completedTaskCount: number;
  sentiment: "BREAKTHROUGH" | "BREAKDOWN" | null;
  resultOfDay: string | null;
  reflection: string | null;
  managerComment: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: { name: string | null; email: string } | null;
  plannedTasks: DsrPlannedTaskData[];
  additionalWorks: DsrAdditionalWorkData[];
  resolvedBlockers: DsrResolvedBlockerData[];
  followUpsDone: DsrFollowUpDoneData[];
  learningItems: DsrLearningItemData[];
  timelineEvents: DsrTimelineEventData[];
};

export type DsrStandupPrefill = {
  plannedTasks: { text: string; priority: string | null }[];
  blockers: { text: string }[];
  followUps: { text: string }[];
  learningItems: { text: string }[];
};

export type DsrInsights = {
  completionPercent: number;
  completedTaskCount: number;
  plannedTaskCount: number;
  streak: number;
  breakthroughDays: number;
  breakdownDays: number;
  weeklyTrend: { day: string; percent: number; isToday: boolean }[];
  daySummary: string;
  insightQuote: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const dsrInclude = {
  plannedTasks: { orderBy: { order: "asc" } },
  additionalWorks: { orderBy: { order: "asc" } },
  resolvedBlockers: { orderBy: { order: "asc" } },
  followUpsDone: { orderBy: { order: "asc" } },
  learningItems: { orderBy: { order: "asc" } },
  timelineEvents: { orderBy: { occurredAt: "asc" } },
  reviewedBy: { select: { name: true, email: true } },
};

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const INSIGHT_QUOTES = [
  "You are 20% more productive on days with fewer than 3 meetings.",
  "Consistency beats intensity — your streak shows up in the numbers.",
  "Days with a clear Day Reflection score 15% higher the next morning.",
  "Your best output happens in the first 4 hours of the day.",
];

// ── Queries ───────────────────────────────────────────────────────────────────

/** Today's DSR entry for the current user (DRAFT or submitted). */
export async function getCurrentDsrEntry(): Promise<DsrEntryData | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const today = toUtcDate();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entry = await (db as any).dsrEntry.findUnique({
    where: { userId_date: { userId: session.user.id, date: today } },
    include: dsrInclude,
  });

  return entry as DsrEntryData | null;
}

/** Today's DSM (StandupEntry) status for the given user (defaults to current session user). */
export async function getTodayDsmStatus(
  userId?: string
): Promise<"DRAFT" | "SUBMITTED" | "PENDING_REVIEW" | "REVIEWED" | "MISSED" | "NONE"> {
  let targetUserId = userId;
  if (!targetUserId) {
    const session = await auth();
    if (!session?.user?.id) return "NONE";
    targetUserId = session.user.id;
  }

  const today = toUtcDate();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const standup = await (db as any).standupEntry.findUnique({
    where: { userId_date: { userId: targetUserId, date: today } },
    select: { status: true },
  });

  return standup?.status ?? "NONE";
}

/** Prefill data from today's StandupEntry for first-time DSR creation. */
export async function getDsrStandupPrefill(): Promise<DsrStandupPrefill> {
  const session = await auth();
  if (!session?.user?.id) return { plannedTasks: [], blockers: [], followUps: [], learningItems: [] };

  const today = toUtcDate();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const standup = await (db as any).standupEntry.findUnique({
    where: { userId_date: { userId: session.user.id, date: today } },
    include: {
      tasks: { where: { kind: "TODAY" }, orderBy: { order: "asc" } },
      blockers: {
        include: {
          mentionedUser: { select: { id: true, name: true, email: true } },
          mentions: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
      supportNeeds: {
        include: {
          mentionedUser: { select: { id: true, name: true, email: true } },
          mentions: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!standup) return { plannedTasks: [], blockers: [], followUps: [], learningItems: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function formatItemTextWithMentions(item: any): string {
    const rawText = item.text || "";
    return rawText.replace(/^(@\S+\s*)+/, "").trim();
  }

  return {
    plannedTasks: standup.tasks.map((t: { text: string; managerPriority: string | null }) => ({
      text: t.text,
      priority: t.managerPriority ?? null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blockers: standup.blockers.map((b: any) => ({ text: formatItemTextWithMentions(b) })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    followUps: standup.supportNeeds.map((s: any) => ({ text: formatItemTextWithMentions(s) })),
    learningItems: standup.learningText
      ? standup.learningText
          .split("\n")
          .map((t: string) => t.trim())
          .filter(Boolean)
          .map((text: string) => ({ text }))
      : [],
  };
}

/** All DSR entries in a given week for the current user (desc date). */
export async function getWeeklyDsrHistory(weekOffset = 0): Promise<DsrEntryData[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const { start, end } = getWeekRange(weekOffset);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries = await (db as any).dsrEntry.findMany({
    where: { userId: session.user.id, date: { gte: start, lte: end } },
    include: dsrInclude,
    orderBy: { date: "desc" },
  });

  return entries as DsrEntryData[];
}

/** Computed insights for the right panel. */
export async function getDsrInsights(
  todayEntry: DsrEntryData | null,
  targetUserId?: string
): Promise<DsrInsights> {
  const session = await auth();
  const userId = targetUserId || session?.user?.id;
  if (!userId) {
    return {
      completionPercent: 0, completedTaskCount: 0, plannedTaskCount: 0,
      streak: 0, breakthroughDays: 0, breakdownDays: 0,
      weeklyTrend: [], daySummary: "", insightQuote: INSIGHT_QUOTES[0],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const today = toUtcDate();

  // 4-week history for sentiment counts and streak
  const fourWeeksAgo = new Date(today);
  fourWeeksAgo.setDate(today.getDate() - 28);

  const recentEntries = await d.dsrEntry.findMany({
    where: { userId, date: { gte: fourWeeksAgo } },
    select: { date: true, status: true, sentiment: true, completionPercent: true },
    orderBy: { date: "desc" },
  });

  // Streak: consecutive submitted days ending today
  let streak = 0;
  const cur = new Date(today);
  while (true) {
    const curStr = cur.toISOString().slice(0, 10);
    const found = recentEntries.find(
      (e: { date: Date; status: string }) =>
        new Date(e.date).toISOString().slice(0, 10) === curStr &&
        (e.status === "SUBMITTED" || e.status === "PENDING_REVIEW" || e.status === "REVIEWED")
    );
    if (!found) break;
    streak++;
    cur.setDate(cur.getDate() - 1);
    if (cur < fourWeeksAgo) break;
  }

  const breakthroughDays = recentEntries.filter(
    (e: { sentiment: string }) => e.sentiment === "BREAKTHROUGH"
  ).length;
  const breakdownDays = recentEntries.filter(
    (e: { sentiment: string }) => e.sentiment === "BREAKDOWN"
  ).length;

  // Weekly trend: Mon-Sun completion percentages
  const { start: weekStart } = getWeekRange(0, today);
  const weeklyTrend = DAY_LABELS.map((day, i) => {
    const dayDate = new Date(weekStart);
    dayDate.setUTCDate(weekStart.getUTCDate() + i);
    const dayStr = dayDate.toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);
    const entry = recentEntries.find(
      (e: { date: Date }) => new Date(e.date).toISOString().slice(0, 10) === dayStr
    );
    return {
      day,
      percent: entry?.completionPercent ?? 0,
      isToday: dayStr === todayStr,
    };
  });

  // Day summary from today's entry
  const cp = todayEntry?.completionPercent ?? 0;
  const ct = todayEntry?.completedTaskCount ?? 0;
  const pt = todayEntry?.plannedTaskCount ?? 0;
  const sentiment = todayEntry?.sentiment;

  let daySummary = "";
  if (cp >= 85 && sentiment === "BREAKTHROUGH") {
    daySummary = `Strong day! You completed ${ct}/${pt} planned tasks (${cp}% completion) — a breakthrough performance. The morning block was particularly productive.`;
  } else if (cp >= 70) {
    daySummary = `Solid day — ${ct}/${pt} tasks completed at ${cp}% completion. You maintained steady focus throughout most of the working hours.`;
  } else if (cp > 0) {
    daySummary = `You completed ${ct}/${pt} planned tasks today (${cp}%). Some items were pushed to tomorrow — consider prioritising those first thing.`;
  } else {
    daySummary = "Fill in your evening review to get today's personalised day summary.";
  }

  const insightQuote = INSIGHT_QUOTES[new Date().getDay() % INSIGHT_QUOTES.length];

  return {
    completionPercent: todayEntry?.completionPercent ?? 0,
    completedTaskCount: todayEntry?.completedTaskCount ?? 0,
    plannedTaskCount: todayEntry?.plannedTaskCount ?? 0,
    streak,
    breakthroughDays,
    breakdownDays,
    weeklyTrend,
    daySummary,
    insightQuote,
  };
}
