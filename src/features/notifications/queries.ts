import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveNotificationHrefs, type NotificationEntityLookup } from "./utils";

export type NotificationItem = {
  id: string;
  type:
    | "DSM_REMINDER"
    | "REPORT_REMINDER"
    | "CALENDAR_INVITE"
    | "PROJECT_ASSIGNED"
    | "CLIENT_INVITATION_SENT"
    | "CLIENT_INVITATION_ACCEPTED"
    | "CLIENT_INVITATION_REVOKED"
    | "CLIENT_ADDED_TO_PROJECT"
    | "CLIENT_REMOVED_FROM_PROJECT";
  title: string;
  message: string;
  readAt: Date | null;
  createdAt: Date;
  createdBy: { name: string | null; email: string };
  teamId: string | null;
  relatedEntryId: string | null;
  /** The page clicking it opens (worked out on the server, related records checked), or null. */
  href: string | null;
};

/** One query per kind of record: which of these ids still exist (projects → their code). */
const lookupNotificationEntities: NotificationEntityLookup = async (entity, ids) => {
  const where = { id: { in: ids } };
  switch (entity) {
    case "project": {
      const rows = await db.project.findMany({ where, select: { id: true, code: true } });
      return new Map(rows.map((r) => [r.id, r.code || r.id]));
    }
    case "leaveRequest": {
      const rows = await db.leaveRequest.findMany({ where, select: { id: true } });
      return new Map(rows.map((r) => [r.id, r.id]));
    }
    case "compOff": {
      const rows = await db.compensatoryRequest.findMany({ where, select: { id: true } });
      return new Map(rows.map((r) => [r.id, r.id]));
    }
    case "calendarEvent": {
      const rows = await db.calendarEvent.findMany({ where, select: { id: true } });
      return new Map(rows.map((r) => [r.id, r.id]));
    }
  }
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

  return resolveNotificationHrefs(rows as Omit<NotificationItem, "href">[], lookupNotificationEntities);
}
