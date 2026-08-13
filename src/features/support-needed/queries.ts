import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SupportCommentItem = {
  id: string;
  text: string;
  createdAt: Date;
  author: { id: string; name: string | null; email: string };
};

export type SupportNeedItem = {
  id: string;
  text: string;
  resolved: boolean;
  date: Date;
  entryId: string;
  raisedBy: { id: string; name: string | null; email: string };
  supportFrom: { id: string; name: string | null; email: string } | null;
  comments: SupportCommentItem[];
  editedBy?: { id: string; name: string | null; email: string } | null;
};

function deduplicateSupportNeeds(items: SupportNeedItem[]): SupportNeedItem[] {
  const seenMap = new Map<string, SupportNeedItem>();

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
 * Support-need items WHERE the current user is the mentionedUser (someone asks help FROM them).
 */
export async function getRequestedFromMe(): Promise<SupportNeedItem[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const rows = await d.standupSupportNeed.findMany({
    where: {
      OR: [
        { mentionedUserId: session.user.id },
        { mentionedUserIds: { contains: session.user.id } },
      ],
    },
    include: {
      entry: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      mentionedUser: { select: { id: true, name: true, email: true } },
      editedBy: { select: { id: true, name: true, email: true } },
      comments: {
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ entry: { date: "desc" } }, { order: "asc" }],
  });

  const dsrEntries = rows.length > 0
    ? await d.dsrEntry.findMany({
        where: {
          OR: rows.map((r: { entry: { userId: string; date: Date } }) => ({
            userId: r.entry.userId,
            date: r.entry.date,
          })),
        },
        include: { followUpsDone: true },
      })
    : [];

  const dsrMap = new Map<string, { text: string; completed: boolean }[]>();
  dsrEntries.forEach((e: { userId: string; date: Date; followUpsDone: { text: string; completed: boolean }[] }) => {
    const key = `${e.userId}_${new Date(e.date).toISOString().slice(0, 10)}`;
    dsrMap.set(key, e.followUpsDone ?? []);
  });

  const items = rows.map((s: {
    id: string;
    text: string;
    resolved: boolean;
    entry: { id: string; userId: string; date: Date; user: { id: string; name: string | null; email: string } };
    mentionedUser: { id: string; name: string | null; email: string } | null;
    editedBy?: { id: string; name: string | null; email: string } | null;
    comments: {
      id: string;
      text: string;
      createdAt: Date;
      author: { id: string; name: string | null; email: string };
    }[];
  }) => {
    const key = `${s.entry.userId}_${new Date(s.entry.date).toISOString().slice(0, 10)}`;
    const dsrFollowUps = dsrMap.get(key) ?? [];
    const cleanSText = s.text.replace(/^(@\S+\s*)+/, "").trim().toLowerCase();
    const isDsrDone = dsrFollowUps.some(
      (fu) =>
        fu.completed &&
        (fu.text.trim().toLowerCase() === cleanSText ||
          cleanSText.includes(fu.text.trim().toLowerCase()) ||
          fu.text.trim().toLowerCase().includes(cleanSText))
    );

    return {
      id: s.id,
      text: s.text,
      resolved: s.resolved || isDsrDone,
      date: s.entry.date,
      entryId: s.entry.id,
      raisedBy: s.entry.user,
      supportFrom: s.mentionedUser,
      editedBy: s.editedBy,
      comments: s.comments,
    };
  });

  return deduplicateSupportNeeds(items);
}

/**
 * All support-need items for the current user.
 * Team member: own entries. Manager: all entries.
 */
export async function getMySupportNeeds(): Promise<SupportNeedItem[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const isManager = session.user.role === "MANAGER";

  const where = isManager
    ? {}
    : {
        OR: [
          { entry: { userId: session.user.id } },
          { mentionedUserId: session.user.id },
          { mentionedUserIds: { contains: session.user.id } },
        ],
      };

  const rows = await d.standupSupportNeed.findMany({
    where,
    include: {
      entry: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      mentionedUser: { select: { id: true, name: true, email: true } },
      editedBy: { select: { id: true, name: true, email: true } },
      comments: {
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ entry: { date: "desc" } }, { order: "asc" }],
  });

  const dsrEntries = rows.length > 0
    ? await d.dsrEntry.findMany({
        where: {
          OR: rows.map((r: { entry: { userId: string; date: Date } }) => ({
            userId: r.entry.userId,
            date: r.entry.date,
          })),
        },
        include: { followUpsDone: true },
      })
    : [];

  const dsrMap = new Map<string, { text: string; completed: boolean }[]>();
  dsrEntries.forEach((e: { userId: string; date: Date; followUpsDone: { text: string; completed: boolean }[] }) => {
    const key = `${e.userId}_${new Date(e.date).toISOString().slice(0, 10)}`;
    dsrMap.set(key, e.followUpsDone ?? []);
  });

  const items = rows.map((s: {
    id: string;
    text: string;
    resolved: boolean;
    entry: { id: string; userId: string; date: Date; user: { id: string; name: string | null; email: string } };
    mentionedUser: { id: string; name: string | null; email: string } | null;
    editedBy?: { id: string; name: string | null; email: string } | null;
    comments: {
      id: string;
      text: string;
      createdAt: Date;
      author: { id: string; name: string | null; email: string };
    }[];
  }) => {
    const key = `${s.entry.userId}_${new Date(s.entry.date).toISOString().slice(0, 10)}`;
    const dsrFollowUps = dsrMap.get(key) ?? [];
    const cleanSText = s.text.replace(/^(@\S+\s*)+/, "").trim().toLowerCase();
    const isDsrDone = dsrFollowUps.some(
      (fu) =>
        fu.completed &&
        (fu.text.trim().toLowerCase() === cleanSText ||
          cleanSText.includes(fu.text.trim().toLowerCase()) ||
          fu.text.trim().toLowerCase().includes(cleanSText))
    );

    return {
      id: s.id,
      text: s.text,
      resolved: s.resolved || isDsrDone,
      date: s.entry.date,
      entryId: s.entry.id,
      raisedBy: s.entry.user,
      supportFrom: s.mentionedUser,
      editedBy: s.editedBy,
      comments: s.comments,
    };
  });

  return deduplicateSupportNeeds(items);
}
