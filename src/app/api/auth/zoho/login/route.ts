import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";

const STATE_COOKIE = "zoho_oauth_state";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL(ROUTES.login, request.url));
  }

  const clientId = process.env.CLIENT_ID ?? process.env.ZOHO_CLIENT_ID;
  const redirectUri = process.env.ZOHO_REDIRECT_URI;
  const accountsDomain = process.env.ZOHO_ACCOUNTS_DOMAIN ?? "accounts.zoho.in";

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Zoho Calendar is not configured (missing CLIENT_ID / ZOHO_CLIENT_ID or ZOHO_REDIRECT_URI)." },
      { status: 500 },
    );
  }

  const state = randomBytes(24).toString("hex");

  const authUrl = new URL(`https://${accountsDomain}/oauth/v2/auth`);
  authUrl.searchParams.set("scope", "ZohoCalendar.calendar.ALL,ZohoCalendar.event.ALL");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
