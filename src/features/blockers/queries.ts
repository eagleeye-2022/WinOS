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
  editedBy?: { id: string; name: string | null; email: string } | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function attachMentionedUsers(items: BlockerItem[]): Promise<BlockerItem[]> {
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

function deduplicateBlockers(items: BlockerItem[]): BlockerItem[] {
  const seenMap = new Map<string, BlockerItem>();

  for (const item of items) {
    const cleanText = item.text.replace(/^(@\S+\s*)+/, "").trim().toLowerCase();
    const key = `${item.raisedBy.id}_${cleanText}`;

    if (!seenMap.has(key)) {
      seenMap.set(key, { ...item, comments: [...(item.comments || [])] });
    } else {
      const existing = seenMap.get(key)!;
      if (item.comments && item.comments.length > 0) {
        const existingCommentIds = new Set(existing.comments.map((c) => c.id));
        item.comments.forEach((c) => {
          if (!existingCommentIds.has(c.id)) {
            existing.comments.push(c);
          }
        });
      }
    }
  }

  return Array.from(seenMap.values());
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Blockers WHERE the current user is the mentionedUser (someone raised a blocker naming them).
 */
export async function getBlockersWithMe(): Promise<BlockerItem[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const rows = await d.standupBlocker.findMany({
    where: {
      OR: [
        { mentionedUserId: session.user.id },
        { mentionedUserIds: { contains: session.user.id } },
      ],
    },
    include: {
      entry: {
        include: { user: { select: { id: true, name: true, email: true, role: true, title: true } } },
      },
      editedBy: { select: { id: true, name: true, email: true } },
      comments: {
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ entry: { date: "desc" } }, { priority: "asc" }],
  });

  const dsrEntries = rows.length > 0
    ? await d.dsrEntry.findMany({
        where: {
          OR: rows.map((r: { entry: { userId: string; date: Date } }) => ({
            userId: r.entry.userId,
            date: r.entry.date,
          })),
        },
        include: { resolvedBlockers: true },
      })
    : [];

  const dsrMap = new Map<string, { text: string; resolved: boolean }[]>();
  dsrEntries.forEach((e: { userId: string; date: Date; resolvedBlockers: { text: string; resolved: boolean }[] }) => {
    const key = `${e.userId}_${new Date(e.date).toISOString().slice(0, 10)}`;
    dsrMap.set(key, e.resolvedBlockers ?? []);
  });

  const items = rows.map((b: {
    id: string;
    text: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    resolved: boolean;
    entry: { id: string; userId: string; date: Date; user: { id: string; name: string | null; email: string; role: string; title: string | null } };
    mentionedUserId?: string | null;
    mentionedUserIds?: string | null;
    editedBy?: { id: string; name: string | null; email: string } | null;
    comments: BlockerCommentItem[];
  }) => {
    const key = `${b.entry.userId}_${new Date(b.entry.date).toISOString().slice(0, 10)}`;
    const dsrBlockers = dsrMap.get(key) ?? [];
    const cleanBText = b.text.replace(/^(@\S+\s*)+/, "").trim().toLowerCase();
    const isDsrResolved = dsrBlockers.some(
      (rb) =>
        rb.resolved &&
        (rb.text.trim().toLowerCase() === cleanBText ||
          cleanBText.includes(rb.text.trim().toLowerCase()) ||
          rb.text.trim().toLowerCase().includes(cleanBText))
    );

    return {
      id: b.id,
      text: b.text,
      priority: b.priority,
      resolved: b.resolved || isDsrResolved,
      date: b.entry.date,
      entryId: b.entry.id,
      raisedBy: b.entry.user,
      mentionedUserId: b.mentionedUserId,
      mentionedUserIds: b.mentionedUserIds,
      editedBy: b.editedBy,
      comments: b.comments,
    };
  });

  const attached = await attachMentionedUsers(items);
  return deduplicateBlockers(attached);
}

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
      editedBy: { select: { id: true, name: true, email: true } },
      comments: {
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ entry: { date: "desc" } }, { priority: "asc" }],
  });

  const dsrEntries = rows.length > 0
    ? await d.dsrEntry.findMany({
        where: {
          OR: rows.map((r: { entry: { userId: string; date: Date } }) => ({
            userId: r.entry.userId,
            date: r.entry.date,
          })),
        },
        include: { resolvedBlockers: true },
      })
    : [];

  const dsrMap = new Map<string, { text: string; resolved: boolean }[]>();
  dsrEntries.forEach((e: { userId: string; date: Date; resolvedBlockers: { text: string; resolved: boolean }[] }) => {
    const key = `${e.userId}_${new Date(e.date).toISOString().slice(0, 10)}`;
    dsrMap.set(key, e.resolvedBlockers ?? []);
  });

  const items = rows.map((b: {
    id: string;
    text: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    resolved: boolean;
    entry: { id: string; userId: string; date: Date; user: { id: string; name: string | null; email: string; role: string; title: string | null } };
    mentionedUserId?: string | null;
    mentionedUserIds?: string | null;
    editedBy?: { id: string; name: string | null; email: string } | null;
    comments: BlockerCommentItem[];
  }) => {
    const key = `${b.entry.userId}_${new Date(b.entry.date).toISOString().slice(0, 10)}`;
    const dsrBlockers = dsrMap.get(key) ?? [];
    const cleanBText = b.text.replace(/^(@\S+\s*)+/, "").trim().toLowerCase();
    const isDsrResolved = dsrBlockers.some(
      (rb) =>
        rb.resolved &&
        (rb.text.trim().toLowerCase() === cleanBText ||
          cleanBText.includes(rb.text.trim().toLowerCase()) ||
          rb.text.trim().toLowerCase().includes(cleanBText))
    );

    return {
      id: b.id,
      text: b.text,
      priority: b.priority,
      resolved: b.resolved || isDsrResolved,
      date: b.entry.date,
      entryId: b.entry.id,
      raisedBy: b.entry.user,
      mentionedUserId: b.mentionedUserId,
      mentionedUserIds: b.mentionedUserIds,
      editedBy: b.editedBy,
      comments: b.comments,
    };
  });

  const attached = await attachMentionedUsers(items);
  return deduplicateBlockers(attached);
}
