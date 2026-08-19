import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getValidZohoAccessToken, listZohoEvents } from "@/lib/zoho-calendar";
import { expandOccurrences, parseRule, type RecurrenceRule } from "./recurrence";

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
  /** Null/undefined = one-off event. Every occurrence view of a recurring event shares this. */
  recurrenceRule?: RecurrenceRule | null;
  /** True for a generated occurrence (not the series' own stored start/end). Editing/deleting still targets the whole series via `id`. */
  isRecurringInstance?: boolean;
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

  const results: CalendarEventView[] = [];
  const seenIds = new Set<string>();

  // 1. Fetch database events (where user is organizer OR an attendee).
  // A recurring event may have been created long before `rangeStart` and still
  // produce occurrences inside it, so recurring rows are matched by "started
  // by rangeEnd" alone — expansion below (and the rule's own `until`) narrows
  // them down to occurrences that actually overlap the range.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbEvents = await (db as any).calendarEvent.findMany({
      where: {
        AND: [
          {
            OR: [
              { recurrenceRule: null, start: { lte: rangeEnd }, end: { gte: rangeStart } },
              { recurrenceRule: { not: null }, start: { lte: rangeEnd } },
            ],
          },
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
      const rule = parseRule(e.recurrenceRule);
      const etag = e.updatedAt ? e.updatedAt.getTime() : Date.now();
      const eventStart = new Date(e.start);
      const eventEnd = new Date(e.end);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attendees = e.attendees.map((a: any) => ({ email: a.email, status: a.status }));

      const base = {
        id: e.id,
        etag,
        title: e.title,
        description: e.description ?? "",
        isAllDay: e.isAllDay,
        organizerEmail: e.organizer?.email ?? undefined,
        attendees,
        recurrenceRule: rule,
      };

      if (!rule) {
        results.push({ ...base, start: eventStart, end: eventEnd });
        seenIds.add(e.id);
        return;
      }

      const occurrences = expandOccurrences(eventStart, eventEnd, rule, rangeStart, rangeEnd);
      occurrences.forEach((occ) => {
        results.push({ ...base, start: occ.start, end: occ.end, isRecurringInstance: true });
      });
      if (occurrences.length > 0) seenIds.add(e.id);
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
        if (!seenIds.has(e.id)) {
          seenIds.add(e.id);
          const rule = parseRule(e.rrule);
          const eventStart = new Date(e.start);
          const eventEnd = new Date(e.end);
          const base = {
            id: e.id,
            etag: e.etag,
            title: e.title,
            description: e.description ?? "",
            isAllDay: e.isAllDay,
            organizerEmail: e.organizerEmail,
            attendees: e.attendees,
            recurrenceRule: rule,
          };

          if (!rule) {
            results.push({ ...base, start: eventStart, end: eventEnd });
          } else {
            const occurrences = expandOccurrences(eventStart, eventEnd, rule, rangeStart, rangeEnd);
            occurrences.forEach((occ) => {
              results.push({ ...base, start: occ.start, end: occ.end, isRecurringInstance: true });
            });
            if (occurrences.length === 0) {
              results.push({ ...base, start: eventStart, end: eventEnd });
            }
          }
        }
      });
    }
  } catch (error) {
    console.error("[calendar] failed to fetch Zoho events:", error);
  }

  return results;
}

export async function getTodayCalendarEvents(): Promise<CalendarEventView[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return getCalendarEvents(start, end);
}

