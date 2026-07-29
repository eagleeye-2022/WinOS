import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type NotificationItem = {
  id: string;
  type: "DSM_REMINDER" | "CALENDAR_INVITE";
  title: string;
  message: string;
  readAt: Date | null;
  createdAt: Date;
  createdBy: { name: string | null; email: string };
  teamId: string | null;
  relatedEntryId: string | null;
};

// ── Queries ───────────────────────────────────────────────────────────────────

/** Unread notification count for the current user. */
export async function getUnreadCount(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db as any).notification.count({
    where: { userId: session.user.id, readAt: null },
  });
}

/** Recent notifications for the current user (newest first). */
export async function getNotifications(limit = 20): Promise<NotificationItem[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (db as any).notification.findMany({
    where: { userId: session.user.id },
    include: { createdBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows as NotificationItem[];
}
