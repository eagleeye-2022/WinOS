import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getValidZohoAccessToken, listZohoEvents } from "@/lib/zoho-calendar";

export type CalendarEventView = {
  id: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  organizerEmail?: string;
  participants: { email: string; status?: string }[];
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

  return { connected: Boolean(account), zohoEmail: account?.zohoEmail ?? null };
}

/**
 * Fetches events from the current user's connected Zoho calendar for the
 * given range. Returns an empty array (never throws) if the user hasn't
 * connected Zoho yet or the API call fails, so the page can render the
 * not-connected empty state instead of crashing.
 */
export async function getCalendarEvents(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarEventView[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  try {
    const token = await getValidZohoAccessToken(session.user.id);
    if (!token || !token.calendarUid) return [];

    const events = await listZohoEvents(token.accessToken, token.apiDomain, token.calendarUid, {
      rangeStart,
      rangeEnd,
    });

    return events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description ?? "",
      start: new Date(e.start),
      end: new Date(e.end),
      isAllDay: e.isAllDay,
      organizerEmail: e.organizerEmail,
      participants: e.participants,
    }));
  } catch (error) {
    console.error("[calendar] failed to fetch Zoho events:", error);
    return [];
  }
}
