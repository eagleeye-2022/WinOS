import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getValidZohoAccessToken, listZohoEvents } from "@/lib/zoho-calendar";

export type CalendarEventView = {
  id: string;
  etag: number;
  title: string;
  description: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  organizerEmail?: string;
  attendees: { email: string; status?: string }[];
};

export type ZohoConnectionStatus = {
  connected: boolean;
  zohoEmail: string | null;
};

export async function getZohoConnectionStatus(): Promise<ZohoConnectionStatus> {
  const session = await auth();
  if (!session?.user?.id) return { connected: false, zohoEmail: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const account = await (db as any).zohoAccount.findUnique({
    where: { userId: session.user.id },
    select: { zohoEmail: true },
  });

  if (account) {
    return { connected: true, zohoEmail: account.zohoEmail ?? session.user.email ?? null };
  }

  // Option 2: Organization Master Account (Auto-Connected for all workspace users)
  if (process.env.ZOHO_ORG_MASTER_REFRESH_TOKEN) {
    return { connected: true, zohoEmail: "Organization Account (Auto-Connected)" };
  }

  return { connected: false, zohoEmail: null };
}

/**
 * Fetches collaborative calendar events for the current user from the database
 * (events organized by the user or where the user is an assigned participant).
 * Also merges Zoho events if Zoho Calendar is connected.
 */
export async function getCalendarEvents(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarEventView[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = session.user.id;
  const userEmail = session.user.email ?? "";

  const eventMap = new Map<string, CalendarEventView>();

  // 1. Fetch database events (where user is organizer OR an attendee)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbEvents = await (db as any).calendarEvent.findMany({
      where: {
        AND: [
          { start: { lte: rangeEnd } },
          { end: { gte: rangeStart } },
          {
            OR: [
              { organizerId: userId },
              {
                attendees: {
                  some: {
                    OR: [
                      { userId: userId },
                      ...(userEmail
                        ? [
                            { email: { equals: userEmail, mode: "insensitive" } },
                            { email: userEmail.toLowerCase() },
                          ]
                        : []),
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
      include: {
        organizer: { select: { email: true, name: true } },
        attendees: { select: { email: true, status: true } },
      },
      orderBy: { start: "asc" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dbEvents.forEach((e: any) => {
      eventMap.set(e.id, {
        id: e.id,
        etag: e.updatedAt ? e.updatedAt.getTime() : Date.now(),
        title: e.title,
        description: e.description ?? "",
        start: new Date(e.start),
        end: new Date(e.end),
        isAllDay: e.isAllDay,
        organizerEmail: e.organizer?.email ?? undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        attendees: e.attendees.map((a: any) => ({
          email: a.email,
          status: a.status,
        })),
      });
    });
  } catch (error) {
    console.error("[calendar] failed to fetch DB events:", error);
  }

  // 2. Fetch Zoho events if connected
  try {
    const token = await getValidZohoAccessToken(userId);
    if (token && token.calendarUid) {
      const zohoEvents = await listZohoEvents(token.accessToken, token.apiDomain, token.calendarUid, {
        rangeStart,
        rangeEnd,
      });

      zohoEvents.forEach((e) => {
        if (!eventMap.has(e.id)) {
          eventMap.set(e.id, {
            id: e.id,
            etag: e.etag,
            title: e.title,
            description: e.description ?? "",
            start: new Date(e.start),
            end: new Date(e.end),
            isAllDay: e.isAllDay,
            organizerEmail: e.organizerEmail,
            attendees: e.attendees,
          });
        }
      });
    }
  } catch (error) {
    console.error("[calendar] failed to fetch Zoho events:", error);
  }

  return Array.from(eventMap.values());
}

