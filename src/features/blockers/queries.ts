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
  raisedBy: { id: string; name: string | null; email: string };
  comments: BlockerCommentItem[];
};

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
    : { entry: { userId: session.user.id } };

  const rows = await d.standupBlocker.findMany({
    where,
    include: {
      entry: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      comments: {
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ entry: { date: "desc" } }, { priority: "asc" }],
  });

  return rows.map((b: {
    id: string;
    text: string;
    priority: string;
    resolved: boolean;
    entry: { id: string; date: Date; user: { id: string; name: string | null; email: string } };
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
    comments: b.comments,
  }));
}
