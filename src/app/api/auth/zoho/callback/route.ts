import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROUTES } from "@/constants/routes";
import { exchangeZohoCodeForToken, listZohoCalendars } from "@/lib/zoho-calendar";

const STATE_COOKIE = "zoho_oauth_state";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL(ROUTES.login, request.url));
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  const calendarUrl = new URL(ROUTES.calendar, request.url);

  if (!code || !state || !expectedState || state !== expectedState) {
    calendarUrl.searchParams.set("error", "zoho_state_mismatch");
    return NextResponse.redirect(calendarUrl);
  }

  try {
    const token = await exchangeZohoCodeForToken(code);

    const calendars = await listZohoCalendars(token.accessToken, token.apiDomain);
    const primaryCalendar = calendars.find((c) => c.isDefault) ?? calendars[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).zohoAccount.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: new Date(Date.now() + token.expiresIn * 1000),
        apiDomain: token.apiDomain,
        accountsDomain: token.accountsDomain,
        primaryCalendarUid: primaryCalendar?.uid ?? null,
        zohoEmail: session.user.email ?? null,
      },
      update: {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: new Date(Date.now() + token.expiresIn * 1000),
        apiDomain: token.apiDomain,
        accountsDomain: token.accountsDomain,
        primaryCalendarUid: primaryCalendar?.uid ?? null,
        zohoEmail: session.user.email ?? null,
      },
    });

    calendarUrl.searchParams.set("connected", "1");
    const response = NextResponse.redirect(calendarUrl);
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (error) {
    console.error("[zoho:callback] failed to connect Zoho account:", error);
    calendarUrl.searchParams.set("error", "zoho_connect_failed");
    return NextResponse.redirect(calendarUrl);
  }
}
