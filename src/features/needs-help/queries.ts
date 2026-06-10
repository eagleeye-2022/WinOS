import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HelpRequestItem = {
  id: string;
  text: string;
  resolved: boolean;
  date: Date;
  entryId: string;
  raisedBy: { id: string; name: string | null; email: string };
};

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Support needs where the current user was mentioned — i.e. someone needs their help.
 */
export async function getHelpRequests(): Promise<HelpRequestItem[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const rows = await d.standupSupportNeed.findMany({
    where: { mentionedUserId: session.user.id },
    include: {
      entry: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: [{ entry: { date: "desc" } }, { order: "asc" }],
  });

  return rows.map((s: {
    id: string;
    text: string;
    resolved: boolean;
    entry: { id: string; date: Date; user: { id: string; name: string | null; email: string } };
  }) => ({
    id: s.id,
    text: s.text,
    resolved: s.resolved,
    date: s.entry.date,
    entryId: s.entry.id,
    raisedBy: s.entry.user,
  }));
}
