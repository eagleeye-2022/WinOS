import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getValidZohoAccessToken, listZohoCalendars } from "@/lib/zoho-calendar";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tokenInfo = await getValidZohoAccessToken(session.user.id);
    if (!tokenInfo) {
      return NextResponse.json(
        { error: "Zoho Calendar account not connected. Please connect via OAuth first." },
        { status: 400 },
      );
    }

    const calendars = await listZohoCalendars(tokenInfo.accessToken, tokenInfo.apiDomain);
    return NextResponse.json({
      success: true,
      calendars,
      primaryCalendarUid: tokenInfo.calendarUid,
    });
  } catch (error) {
    console.error("[api:zoho:calendars] failed to list calendars:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch Zoho calendars" },
      { status: 500 },
    );
  }
}
