import { db } from "@/lib/db";

// ── Zoho Calendar OAuth + API client ────────────────────────────────────────
// Per-user integration: each WinOS user connects their own Zoho account via
// the OAuth routes under src/app/api/auth/zoho/. Tokens are stored on the
// ZohoAccount model (one row per user), never in a shared/service account.
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

export type ZohoEventParticipant = {
  email: string;
  status?: string;
};

export type ZohoEvent = {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  isAllDay: boolean;
  organizerEmail?: string;
  participants: ZohoEventParticipant[];
};

export type NewZohoEventInput = {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  timezone: string;
  participantEmails: string[];
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

function requireOAuthEnv() {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Zoho Calendar is not configured. Set CLIENT_ID and CLIENT_SECRET in the environment.",
    );
  }
  return { clientId, clientSecret };
}

// ── Token exchange / refresh ────────────────────────────────────────────────

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
    apiDomain: (data.api_domain as string | undefined)?.replace(/^https?:\/\//, "") ??
      process.env.ZOHO_API_DOMAIN ??
      "calendar.zoho.in",
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
  if (!account) return null;

  if (account.expiresAt.getTime() - Date.now() < EXPIRY_SAFETY_MARGIN_MS) {
    const refreshed = await refreshZohoToken(account);
    return {
      accessToken: refreshed.accessToken,
      apiDomain: account.apiDomain,
      calendarUid: account.primaryCalendarUid,
    };
  }

  return {
    accessToken: account.accessToken,
    apiDomain: account.apiDomain,
    calendarUid: account.primaryCalendarUid,
  };
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

/**
 * NOTE: exact query param names for range filtering are not yet verified
 * against live Zoho Calendar API v1 docs — adjust `range`/`sdate`/`edate`
 * param names here if Zoho responds with an error or ignores the filter.
 */
export async function listZohoEvents(
  accessToken: string,
  apiDomain: string,
  calendarUid: string,
  range: { rangeStart: Date; rangeEnd: Date },
): Promise<ZohoEvent[]> {
  const params = new URLSearchParams({
    range: JSON.stringify({
      start: toZohoDateTimeString(range.rangeStart),
      end: toZohoDateTimeString(range.rangeEnd),
    }),
  });
  const data = await zohoFetch(
    apiDomain,
    accessToken,
    `/calendars/${calendarUid}/events?${params.toString()}`,
  );
  const events = data.events ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return events.map((e: any) => normalizeZohoEvent(e));
}

/**
 * NOTE: the exact create/update event JSON payload shape (field names,
 * casing, whether it's raw JSON or an `eventdata=<json>` form param) is not
 * verified against a live Zoho account — treat the first real API response
 * as ground truth and adjust the body shape below if Zoho rejects it.
 */
export async function createZohoEvent(
  accessToken: string,
  apiDomain: string,
  calendarUid: string,
  input: NewZohoEventInput,
): Promise<ZohoEvent> {
  const body = {
    title: input.title,
    description: input.description ?? "",
    dateandtime: {
      timezone: input.timezone,
      start: toZohoDateTimeString(input.start),
      end: toZohoDateTimeString(input.end),
    },
    isallday: input.isAllDay,
    participants: input.participantEmails.map((email) => ({ email })),
  };

  const data = await zohoFetch(apiDomain, accessToken, `/calendars/${calendarUid}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return normalizeZohoEvent(data.events?.[0] ?? data);
}

export async function updateZohoEvent(
  accessToken: string,
  apiDomain: string,
  calendarUid: string,
  eventId: string,
  input: NewZohoEventInput,
): Promise<ZohoEvent> {
  const body = {
    title: input.title,
    description: input.description ?? "",
    dateandtime: {
      timezone: input.timezone,
      start: toZohoDateTimeString(input.start),
      end: toZohoDateTimeString(input.end),
    },
    isallday: input.isAllDay,
    participants: input.participantEmails.map((email) => ({ email })),
  };

  const data = await zohoFetch(
    apiDomain,
    accessToken,
    `/calendars/${calendarUid}/events/${eventId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  return normalizeZohoEvent(data.events?.[0] ?? data);
}

export async function deleteZohoEvent(
  accessToken: string,
  apiDomain: string,
  calendarUid: string,
  eventId: string,
): Promise<void> {
  await zohoFetch(apiDomain, accessToken, `/calendars/${calendarUid}/events/${eventId}`, {
    method: "DELETE",
  });
}

/**
 * NOTE: RSVP endpoint/shape unverified — Zoho may expose this as a query
 * param on the PUT event endpoint rather than a distinct route.
 */
export async function respondToZohoEvent(
  accessToken: string,
  apiDomain: string,
  calendarUid: string,
  eventId: string,
  response: "accept" | "decline" | "tentative",
): Promise<void> {
  await zohoFetch(
    apiDomain,
    accessToken,
    `/calendars/${calendarUid}/events/${eventId}?action=rsvp&status=${response}`,
    { method: "PUT" },
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeZohoEvent(raw: any): ZohoEvent {
  return {
    id: raw.uid ?? raw.id,
    title: raw.title ?? "(untitled)",
    description: raw.description ?? "",
    start: raw.dateandtime?.start ?? raw.start,
    end: raw.dateandtime?.end ?? raw.end,
    isAllDay: Boolean(raw.isallday),
    organizerEmail: raw.organizer?.email,
    participants: (raw.participants ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => ({ email: p.email, status: p.status }),
    ),
  };
}

/** Zoho's expected date-time string format — format unverified, adjust if rejected. */
export function toZohoDateTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}
