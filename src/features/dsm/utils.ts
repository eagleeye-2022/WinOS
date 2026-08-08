// Pure helpers — no server imports, fully unit-testable.

/** Normalize a Date to UTC midnight so it matches seed/DB date values. */
export function toUtcDate(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Get UTC midnight date from an ISO string like "2026-05-28". */
export function isoToUtcDate(iso: string): Date {
  return new Date(iso + "T00:00:00.000Z");
}

/** Format a Date as "YYYY-MM-DD" (UTC). */
export function toIsoDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** ISO week number (1–53). */
export function isoWeek(d: Date): number {
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const daysDiff = (d.getTime() - startOfWeek1.getTime()) / 86400000;
  return Math.floor(daysDiff / 7) + 1;
}

/** Week number within the month (1-based). */
export function weekOfMonth(d: Date): number {
  const firstDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const offset = (firstDay.getUTCDay() + 6) % 7; // Mon=0
  return Math.ceil((d.getUTCDate() + offset) / 7);
}

/** Monday–Sunday range for a given week offset (0 = current week). */
export function getWeekRange(weekOffset: number, from: Date = new Date()): { start: Date; end: Date } {
  const base = toUtcDate(from);
  const dayOfWeek = base.getUTCDay(); // 0=Sun
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() - daysSinceMonday + weekOffset * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

export type ReviewStatus =
  | { label: "Pending Review"; kind: "pending" }
  | { label: string; kind: "reviewed" } // "Reviewed by X"
  | { label: "Missed Deadline"; kind: "missed-deadline" }
  | { label: "None"; kind: "none" };

type EntryStatusInput = {
  status: string;
  date: Date;
  reviewedAt: Date | null;
  reviewedBy: { name: string | null } | null;
};

/** Compute the display review status shown on the right side of a day card. */
export function reviewStatus(entry: EntryStatusInput): ReviewStatus {
  if (entry.status === "MISSED") return { label: "None", kind: "none" };
  if (entry.status === "REVIEWED") {
    return {
      label: `Reviewed by ${entry.reviewedBy?.name?.split(" ")[0] ?? "Manager"}`,
      kind: "reviewed",
    };
  }
  const ageMs = Date.now() - new Date(entry.date).getTime();
  const ageDays = ageMs / 86400000;
  if (
    (entry.status === "SUBMITTED" || entry.status === "PENDING_REVIEW") &&
    ageDays > 2 &&
    !entry.reviewedAt
  ) {
    return { label: "Missed Deadline", kind: "missed-deadline" };
  }
  if (entry.status === "SUBMITTED" || entry.status === "PENDING_REVIEW") {
    return { label: "Pending Review", kind: "pending" };
  }
  return { label: "None", kind: "none" };
}

/** Short label for a date relative to today. */
export function relativeDayLabel(date: Date, today: Date = new Date()): string | null {
  const todayUtc = toUtcDate(today);
  const dateUtc = toUtcDate(date);
  const diff = Math.round(
    (todayUtc.getTime() - dateUtc.getTime()) / 86400000
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return null;
}

/** Format a date like "May 28" */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

/** Format a date like "Tuesday • Week 22" */
export function formatDayHeader(date: Date): string {
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(date);
  return `${day} • Week ${isoWeek(date)}`;
}

/** Format a date like "May 28, 2026" */
export function formatFullDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

// ── Team & Member Sequence Helpers ──────────────────────────────────────────

export function getTeamRank(teamName: string, department?: string | null): number {
  const lowerName = (teamName || "").toLowerCase();
  const lowerDept = (department || "").toLowerCase();

  // 1. Marketing / Growth / SMM Team
  if (
    lowerName.includes("marketing") ||
    lowerDept.includes("marketing") ||
    lowerName.includes("smm") ||
    lowerName.includes("growth")
  ) {
    return 1;
  }
  // 2. Creative / Design Team
  if (
    lowerName.includes("creative") ||
    lowerName.includes("design") ||
    lowerDept.includes("creative") ||
    lowerDept.includes("design")
  ) {
    return 2;
  }
  // 3. Tech / Engineering Team
  if (
    lowerName.includes("tech") ||
    lowerName.includes("engineering") ||
    lowerDept.includes("tech") ||
    lowerDept.includes("engineering")
  ) {
    return 3;
  }

  return 99;
}

export function sortTeamMembers<
  T extends {
    name?: string | null;
    email?: string;
    userId?: string;
    user?: { name?: string | null; email?: string };
  }
>(members: T[], teamName: string): T[] {
  const lowerTeam = (teamName || "").toLowerCase();
  const isCreative = lowerTeam.includes("creative") || lowerTeam.includes("design");
  const isTech = lowerTeam.includes("tech") || lowerTeam.includes("engineering");

  function getMemberRank(member: T): number {
    const rawName = member.name || member.user?.name || member.email || member.user?.email || "";
    const name = rawName.toLowerCase();

    if (isCreative) {
      if (name.includes("shadab") || name.includes("shadb")) return 1;
    }

    if (isTech) {
      if (name.includes("ujjwal") || name.includes("ujjawal")) return 1;
      if (name.startsWith("m") || name.includes("mohit") || name.includes("marcus")) return 2;
    }

    return 99;
  }

  return [...members].sort((a, b) => {
    const rankA = getMemberRank(a);
    const rankB = getMemberRank(b);
    if (rankA !== rankB) return rankA - rankB;

    const nameA = (a.name || a.user?.name || a.email || a.user?.email || "").toLowerCase();
    const nameB = (b.name || b.user?.name || b.email || b.user?.email || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

type MemberItem = {
  name?: string | null;
  email?: string;
  userId?: string;
  user?: { name?: string | null; email?: string };
};

export function sortTeamGroups<
  M extends MemberItem,
  T extends { teamName?: string; name?: string; department?: string | null; members?: M[] }
>(groups: T[]): T[] {
  const sortedWithMembers = [...groups].map((g) => {
    if (Array.isArray(g.members)) {
      const tName = g.teamName || g.name || "";
      return {
        ...g,
        members: sortTeamMembers(g.members, tName),
      };
    }
    return g;
  });

  return sortedWithMembers.sort((a, b) => {
    const nameA = a.teamName || a.name || "";
    const nameB = b.teamName || b.name || "";
    const rankA = getTeamRank(nameA, a.department);
    const rankB = getTeamRank(nameB, b.department);
    if (rankA !== rankB) return rankA - rankB;
    return nameA.localeCompare(nameB);
  });
}
