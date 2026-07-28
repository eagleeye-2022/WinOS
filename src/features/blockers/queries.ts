import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BlockerCommentItem = {
  id: string;
  text: string;
  createdAt: Date;
  author: { id: string; name: string | null; email: string };
};

export type BlockerItem = {
  id: string;
  text: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  resolved: boolean;
  date: Date;
  entryId: string;
  raisedBy: { id: string; name: string | null; email: string; role: string; title: string | null };
  mentionedUserId?: string | null;
  mentionedUserIds?: string | null;
  mentionedUsers?: { id: string; name: string | null; email: string }[];
  comments: BlockerCommentItem[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function attachMentionedUsers<T extends { mentionedUserId?: string | null; mentionedUserIds?: string | null }>(items: T[]): Promise<(T & { mentionedUsers: { id: string; name: string | null; email: string }[] })[]> {
  const idsToMention = (item: { mentionedUserId?: string | null; mentionedUserIds?: string | null }) =>
    item.mentionedUserIds
      ? item.mentionedUserIds.split(",").filter(Boolean)
      : item.mentionedUserId
        ? [item.mentionedUserId]
        : [];

  const allIds = new Set<string>();
  for (const item of items) {
    idsToMention(item).forEach((id) => allIds.add(id));
  }
  if (allIds.size === 0) return items.map((item) => ({ ...item, mentionedUsers: [] }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = await (db as any).user.findMany({
    where: { id: { in: Array.from(allIds) } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u: { id: string }) => [u.id, u]));

  return items.map((item) => ({
    ...item,
    mentionedUsers: idsToMention(item)
      .map((id) => userMap.get(id))
      .filter((u): u is { id: string; name: string | null; email: string } => Boolean(u)),
  }));
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * All blockers for the current user (team member: own entries; manager: all entries).
 * Includes items from every entry status — Draft, Submitted, Reviewed, etc.
 */
export async function getMyBlockers(): Promise<BlockerItem[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const isManager = session.user.role === "MANAGER";

  const where = isManager
    ? {} // managers see all blockers
    : {
      OR: [
        { entry: { userId: session.user.id } },
        { mentionedUserId: session.user.id },
        { mentionedUserIds: { contains: session.user.id } },
      ],
    };

  const rows = await d.standupBlocker.findMany({
    where,
    include: {
      entry: {
        include: { user: { select: { id: true, name: true, email: true, role: true, title: true } } },
      },
      comments: {
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ entry: { date: "desc" } }, { priority: "asc" }],
  });

  const items = rows.map((b: {
    id: string;
    text: string;
    priority: string;
    resolved: boolean;
    mentionedUserId?: string | null;
    mentionedUserIds?: string | null;
    entry: { id: string; date: Date; user: { id: string; name: string | null; email: string; role: string; title: string | null } };
    comments: {
      id: string;
      text: string;
      createdAt: Date;
      author: { id: string; name: string | null; email: string };
    }[];
  }) => ({
    id: b.id,
    text: b.text,
    priority: b.priority as "LOW" | "MEDIUM" | "HIGH",
    resolved: b.resolved,
    date: b.entry.date,
    entryId: b.entry.id,
    raisedBy: b.entry.user,
    mentionedUserId: b.mentionedUserId,
    mentionedUserIds: b.mentionedUserIds,
    comments: b.comments,
  }));

  return attachMentionedUsers(items);
}
