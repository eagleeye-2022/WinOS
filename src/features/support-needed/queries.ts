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
};

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
      comments: {
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ entry: { date: "desc" } }, { order: "asc" }],
  });

  return rows.map((s: {
    id: string;
    text: string;
    resolved: boolean;
    entry: { id: string; date: Date; user: { id: string; name: string | null; email: string } };
    mentionedUser: { id: string; name: string | null; email: string } | null;
    comments: {
      id: string;
      text: string;
      createdAt: Date;
      author: { id: string; name: string | null; email: string };
    }[];
  }) => ({
    id: s.id,
    text: s.text,
    resolved: s.resolved,
    date: s.entry.date,
    entryId: s.entry.id,
    raisedBy: s.entry.user,
    supportFrom: s.mentionedUser,
    comments: s.comments,
  }));
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
      comments: {
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ entry: { date: "desc" } }, { order: "asc" }],
  });

  return rows.map((s: {
    id: string;
    text: string;
    resolved: boolean;
    entry: { id: string; date: Date; user: { id: string; name: string | null; email: string } };
    mentionedUser: { id: string; name: string | null; email: string } | null;
    comments: {
      id: string;
      text: string;
      createdAt: Date;
      author: { id: string; name: string | null; email: string };
    }[];
  }) => ({
    id: s.id,
    text: s.text,
    resolved: s.resolved,
    date: s.entry.date,
    entryId: s.entry.id,
    raisedBy: s.entry.user,
    supportFrom: s.mentionedUser,
    comments: s.comments,
  }));
}
