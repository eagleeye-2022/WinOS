import { db } from "@/lib/db";

// ── Zoho Calendar OAuth + API client ────────────────────────────────────────
// Per-user integration: each WinOS user connects their own Zoho account via
// the OAuth routes under src/app/api/auth/zoho/. Tokens are stored on the
// ZohoAccount model (one row per user), never in a shared/service account.
//
// Verified against https://www.zoho.com/calendar/help/api/ (introduction,
// oauth2-user-guide, get-calendar-list, get-events-list, post-create-event,
// put-update-event, delete-event):
//   - Auth header is `Zoho-oauthtoken <token>`, not `Bearer <token>`.
//   - Create/update send an `eventdata` JSON payload as a URL QUERY PARAM,
//     not a request body.
//   - Attendees are sent/returned under the `attendees` field (not
//     `participants`), shaped as { email, status }.
//   - Update and delete require the event's `etag` (returned on every read),
//     sent as an `etag` header.
//   - There is no dedicated RSVP endpoint — responding to an invite is a
//     read (to get the current attendees + etag), mutate your own attendee
//     entry's status, then PUT the full event back.
//   - `range` queries for listing events are capped at a 31-day span.
//
// Env vars used (see .env):
//   CLIENT_ID / CLIENT_SECRET   — Zoho API Console app credentials
//   ZOHO_REDIRECT_URI           — must exactly match the Zoho API Console registration
//   ZOHO_ACCOUNTS_DOMAIN        — e.g. accounts.zoho.in (DC-specific, used for token calls)
//   ZOHO_API_DOMAIN             — e.g. calendar.zoho.in (DC-specific default; the actual
//                                  per-account api_domain returned at OAuth time takes
//                                  precedence once a ZohoAccount row exists)

export class ZohoApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ZohoApiError";
    this.status = status;
    this.code = code;
  }
}

export type ZohoCalendar = {
  uid: string;
  name: string;
  isDefault: boolean;
};

export type ZohoEventAttendee = {
  email: string;
  status?: string;
};

export type ZohoEvent = {
  id: string;
  etag: number;
  title: string;
  description?: string;
  start: string;
  end: string;
  timezone?: string;
  isAllDay: boolean;
  organizerEmail?: string;
  rrule?: string;
  attendees: ZohoEventAttendee[];
};

export type NewZohoEventInput = {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  timezone: string;
  attendeeEmails: string[];
  rrule?: string;
};

type ZohoAccountRow = {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  apiDomain: string;
  accountsDomain: string;
  zohoEmail: string | null;
  primaryCalendarUid: string | null;
};

const RSVP_STATUS: Record<"accept" | "decline" | "tentative", string> = {
  accept: "ACCEPTED",
  decline: "DECLINED",
  tentative: "TENTATIVE",
};

const MAX_RANGE_DAYS = 31;

function requireOAuthEnv() {
  const clientId = process.env.CLIENT_ID ?? process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET ?? process.env.ZOHO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Zoho Calendar is not configured. Set CLIENT_ID (or ZOHO_CLIENT_ID) and CLIENT_SECRET (or ZOHO_CLIENT_SECRET) in the environment.",
    );
  }
  return { clientId, clientSecret };
}

// ── Token exchange / refresh ────────────────────────────────────────────────

export function getCalendarApiDomain(domainFromToken?: string): string {
  if (process.env.ZOHO_API_DOMAIN) {
    return process.env.ZOHO_API_DOMAIN.replace(/^https?:\/\//, "");
  }
  if (!domainFromToken) return "calendar.zoho.in";
  const clean = domainFromToken.replace(/^https?:\/\//, "");
  if (clean.includes("zohoapis.")) {
    return clean.replace(/^(www\.)?zohoapis\./, "calendar.zoho.");
  }
  if (clean.includes("zoho.")) {
    return clean.replace(/^(www\.)?zoho\./, "calendar.zoho.");
  }
  return clean;
}

export async function exchangeZohoCodeForToken(code: string) {
  const { clientId, clientSecret } = requireOAuthEnv();
  const redirectUri = process.env.ZOHO_REDIRECT_URI;
  const accountsDomain = process.env.ZOHO_ACCOUNTS_DOMAIN ?? "accounts.zoho.in";
  if (!redirectUri) throw new Error("ZOHO_REDIRECT_URI is not set.");

  const res = await fetch(`https://${accountsDomain}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new ZohoApiError(
      data.error_description ?? data.error ?? "Failed to exchange Zoho authorization code",
      res.status,
      data.error,
    );
  }

  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresIn: data.expires_in as number,
    apiDomain: getCalendarApiDomain(data.api_domain as string | undefined),
    accountsDomain,
  };
}

export async function refreshZohoToken(account: ZohoAccountRow) {
  const { clientId, clientSecret } = requireOAuthEnv();

  const res = await fetch(`https://${account.accountsDomain}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refreshToken,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new ZohoApiError(
      data.error_description ?? data.error ?? "Failed to refresh Zoho access token",
      res.status,
      data.error,
    );
  }

  const accessToken = data.access_token as string;
  const expiresAt = new Date(Date.now() + (data.expires_in as number) * 1000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).zohoAccount.update({
    where: { id: account.id },
    data: { accessToken, expiresAt },
  });

  return { accessToken, expiresAt };
}

const EXPIRY_SAFETY_MARGIN_MS = 2 * 60 * 1000;

let cachedMasterToken: { accessToken: string; expiresAt: number; apiDomain: string; calendarUid: string } | null = null;

export async function getMasterZohoToken(): Promise<{ accessToken: string; apiDomain: string; calendarUid: string } | null> {
  const masterRefreshToken = process.env.ZOHO_ORG_MASTER_REFRESH_TOKEN;
  if (!masterRefreshToken) return null;

  if (cachedMasterToken && cachedMasterToken.expiresAt - Date.now() > EXPIRY_SAFETY_MARGIN_MS) {
    return {
      accessToken: cachedMasterToken.accessToken,
      apiDomain: cachedMasterToken.apiDomain,
      calendarUid: cachedMasterToken.calendarUid,
    };
  }

  const clientId = process.env.CLIENT_ID ?? process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET ?? process.env.ZOHO_CLIENT_SECRET;
  const accountsDomain = process.env.ZOHO_ACCOUNTS_DOMAIN ?? "accounts.zoho.in";

  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch(`https://${accountsDomain}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: masterRefreshToken,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      console.error("[zoho:master] Failed to refresh Master Token:", data);
      return null;
    }

    const accessToken = data.access_token as string;
    const expiresIn = (data.expires_in as number) ?? 3600;
    const expiresAt = Date.now() + expiresIn * 1000;
    const apiDomain = getCalendarApiDomain(data.api_domain as string | undefined);
    const calendarUid = process.env.ZOHO_ORG_MASTER_CALENDAR_ID ?? "b6d6265ec4de49f388a612d3fb376a0b";

    cachedMasterToken = { accessToken, expiresAt, apiDomain, calendarUid };

    return { accessToken, apiDomain, calendarUid };
  } catch (error) {
    console.error("[zoho:master] Error getting Master Token:", error);
    return null;
  }
}

/**
 * Returns a valid access token + api domain for the given user, refreshing
 * it first if it's expired/about to expire. Returns null if the user hasn't
 * connected a Zoho account yet.
 */
export async function getValidZohoAccessToken(
  userId: string,
): Promise<{ accessToken: string; apiDomain: string; calendarUid: string | null } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const account = (await (db as any).zohoAccount.findUnique({ where: { userId } })) as
    | ZohoAccountRow
    | null;

  if (account) {
    let accessToken = account.accessToken;
    if (account.expiresAt.getTime() - Date.now() < EXPIRY_SAFETY_MARGIN_MS) {
      const refreshed = await refreshZohoToken(account);
      accessToken = refreshed.accessToken;
    }

    const apiDomain = getCalendarApiDomain(account.apiDomain);

    let calendarUid = account.primaryCalendarUid;
    if (!calendarUid) {
      try {
        const cals = await listZohoCalendars(accessToken, apiDomain);
        const primary = cals.find((c) => c.isDefault) ?? cals[0];
        if (primary?.uid) {
          calendarUid = primary.uid;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (db as any).zohoAccount.update({
            where: { userId },
            data: { primaryCalendarUid: calendarUid, apiDomain },
          });
        }
      } catch (e) {
        console.warn("[zoho] Failed to auto-fetch primary calendarUid:", e);
      }
    }

    return {
      accessToken,
      apiDomain,
      calendarUid,
    };
  }

  // Option 2 Fallback: Organization Master Account
  const master = await getMasterZohoToken();
  if (master) {
    return {
      accessToken: master.accessToken,
      apiDomain: master.apiDomain,
      calendarUid: master.calendarUid,
    };
  }

  return null;
}

// ── Calendar API v1 ──────────────────────────────────────────────────────────

async function zohoFetch(
  apiDomain: string,
  accessToken: string,
  path: string,
  init?: RequestInit,
) {
  const res = await fetch(`https://${apiDomain}/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new ZohoApiError(
      data?.message ?? data?.error_description ?? `Zoho API request failed (${res.status})`,
      res.status,
      data?.error_code ?? data?.error,
    );
  }

  return data;
}

export async function listZohoCalendars(
  accessToken: string,
  apiDomain: string,
): Promise<ZohoCalendar[]> {
  const data = await zohoFetch(apiDomain, accessToken, "/calendars");
  const calendars = data.calendars ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return calendars.map((c: any) => ({
    uid: c.uid,
    name: c.name,
    isDefault: Boolean(c.isdefault),
  }));
}

/** Split a date range into <=31-day chunks — Zoho's `range` query param caps at 31 days. */
function splitRangeIntoChunks(rangeStart: Date, rangeEnd: Date): { start: Date; end: Date }[] {
  const chunks: { start: Date; end: Date }[] = [];
  let chunkStart = new Date(rangeStart);

  while (chunkStart < rangeEnd) {
    const chunkEnd = new Date(chunkStart);
    chunkEnd.setDate(chunkEnd.getDate() + MAX_RANGE_DAYS);
    chunks.push({ start: chunkStart, end: chunkEnd < rangeEnd ? chunkEnd : rangeEnd });
    chunkStart = chunkEnd;
  }

  return chunks;
}

export async function listZohoEvents(
  accessToken: string,
  apiDomain: string,
  calendarUid: string,
  range: { rangeStart: Date; rangeEnd: Date },
): Promise<ZohoEvent[]> {
  const chunks = splitRangeIntoChunks(range.rangeStart, range.rangeEnd);
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const params = new URLSearchParams({
        range: JSON.stringify({
          start: toZohoDateTimeString(chunk.start),
          end: toZohoDateTimeString(chunk.end),
        }),
      });
      const data = await zohoFetch(
        apiDomain,
        accessToken,
        `/calendars/${calendarUid}/events?${params.toString()}`,
        { headers: { Accept: "application/json+large" } },
      );
      const events = data.events ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return events.map((e: any) => normalizeZohoEvent(e));
    }),
  );

  const seen = new Set<string>();
  const merged: ZohoEvent[] = [];
  for (const event of results.flat()) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    merged.push(event);
  }
  return merged;
}

export async function getZohoEventById(
  accessToken: string,
  apiDomain: string,
  calendarUid: string,
  eventId: string,
): Promise<ZohoEvent> {
  const data = await zohoFetch(apiDomain, accessToken, `/calendars/${calendarUid}/events/${eventId}`, {
    headers: { Accept: "application/json+large" },
  });
  return normalizeZohoEvent(data.events?.[0] ?? data);
}

function buildEventData(input: NewZohoEventInput) {
  const eventdata: Record<string, unknown> = {
    title: input.title,
    description: input.description ?? "",
    dateandtime: {
      timezone: input.timezone,
      start: toZohoDateTimeString(input.start),
      end: toZohoDateTimeString(input.end),
    },
    isallday: input.isAllDay,
  };

  if (input.rrule) {
    eventdata.rrule = input.rrule;
  }

  if (input.attendeeEmails && input.attendeeEmails.length > 0) {
    eventdata.attendees = input.attendeeEmails.map((email) => ({ email, status: "NEEDS-ACTION" }));
  }

  return eventdata;
}

/** POST/PUT with `eventdata` as a URL query param, per Zoho's documented API shape. */
async function putOrPostEventData(
  accessToken: string,
  apiDomain: string,
  path: string,
  method: "POST" | "PUT",
  eventdata: object,
  etag?: number,
) {
  const params = new URLSearchParams({ eventdata: JSON.stringify(eventdata) });
  const data = await zohoFetch(apiDomain, accessToken, `${path}?${params.toString()}`, {
    method,
    headers: etag !== undefined ? { etag: String(etag) } : undefined,
  });
  return normalizeZohoEvent(data.events?.[0] ?? data);
}

export async function createZohoEvent(
  accessToken: string,
  apiDomain: string,
  calendarUid: string,
  input: NewZohoEventInput,
): Promise<ZohoEvent> {
  return putOrPostEventData(
    accessToken,
    apiDomain,
    `/calendars/${calendarUid}/events`,
    "POST",
    buildEventData(input),
  );
}

export async function updateZohoEvent(
  accessToken: string,
  apiDomain: string,
  calendarUid: string,
  eventId: string,
  input: NewZohoEventInput,
  etag: number,
): Promise<ZohoEvent> {
  const eventdata = { ...buildEventData(input), etag };
  return putOrPostEventData(
    accessToken,
    apiDomain,
    `/calendars/${calendarUid}/events/${eventId}`,
    "PUT",
    eventdata,
    etag,
  );
}

export async function deleteZohoEvent(
  accessToken: string,
  apiDomain: string,
  calendarUid: string,
  eventId: string,
  etag: number,
): Promise<void> {
  await zohoFetch(apiDomain, accessToken, `/calendars/${calendarUid}/events/${eventId}`, {
    method: "DELETE",
    headers: { etag: String(etag) },
  });
}

/**
 * There is no dedicated RSVP endpoint. Responding to an invite means: read
 * the event to get its current attendees + etag, flip the responding user's
 * own attendee status, then PUT the full event back with that etag.
 */
export async function respondToZohoEvent(
  accessToken: string,
  apiDomain: string,
  calendarUid: string,
  eventId: string,
  currentUserEmail: string,
  response: "accept" | "decline" | "tentative",
): Promise<void> {
  const event = await getZohoEventById(accessToken, apiDomain, calendarUid, eventId);

  const updatedAttendees = event.attendees.map((a) =>
    a.email.toLowerCase() === currentUserEmail.toLowerCase()
      ? { ...a, status: RSVP_STATUS[response] }
      : a,
  );

  const eventdata = {
    title: event.title,
    description: event.description ?? "",
    dateandtime: {
      timezone: event.timezone,
      start: event.start,
      end: event.end,
    },
    isallday: event.isAllDay,
    attendees: updatedAttendees,
    etag: event.etag,
  };

  await putOrPostEventData(
    accessToken,
    apiDomain,
    `/calendars/${calendarUid}/events/${eventId}`,
    "PUT",
    eventdata,
    event.etag,
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeZohoEvent(raw: any): ZohoEvent {
  return {
    id: raw.uid ?? raw.id,
    etag: Number(raw.etag) || 0,
    title: raw.title ?? "(untitled)",
    description: raw.description ?? "",
    start: raw.dateandtime?.start ?? raw.start,
    end: raw.dateandtime?.end ?? raw.end,
    timezone: raw.dateandtime?.timezone,
    isAllDay: Boolean(raw.isallday),
    organizerEmail: raw.organizer?.email,
    rrule: raw.rrule || raw.recurrence || undefined,
    attendees: (raw.attendees ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any) => ({ email: a.email, status: a.status }),
    ),
  };
}

/** Zoho's documented date-time format: yyyyMMdd'T'HHmmss'Z' (UTC). */
export function toZohoDateTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}
