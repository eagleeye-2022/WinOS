import { db } from "../src/lib/db";
import { getValidZohoAccessToken, listZohoCalendars } from "../src/lib/zoho-calendar";

async function main() {
  console.log("=== Checking Database Zoho Accounts ===");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts = await (db as any).zohoAccount.findMany({
    include: { user: { select: { email: true, name: true } } },
  });

  console.log(`Found ${accounts.length} Zoho Account(s) in DB:`);
  accounts.forEach((acc: Record<string, unknown>) => {
    const u = acc.user as { email?: string } | undefined;
    console.log({
      id: acc.id,
      userId: acc.userId,
      userEmail: u?.email,
      zohoEmail: acc.zohoEmail,
      primaryCalendarUid: acc.primaryCalendarUid,
      apiDomain: acc.apiDomain,
      expiresAt: acc.expiresAt,
    });
  });

  if (accounts.length > 0) {
    const userId = accounts[0].userId;
    console.log(`\n=== Testing Token & Calendars for User ID: ${userId} ===`);
    const tokenInfo = await getValidZohoAccessToken(userId);
    console.log("Token Info:", tokenInfo);

    if (tokenInfo) {
      const calendars = await listZohoCalendars(tokenInfo.accessToken, tokenInfo.apiDomain);
      console.log("Fetched Calendars from Zoho API:", calendars);
    }
  }

  console.log("\n=== Checking Recent DB Calendar Events ===");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = await (db as any).calendarEvent.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { organizer: { select: { email: true } } },
  });

  console.log(`Found ${events.length} recent event(s) in DB:`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  events.forEach((e: any) => {
    console.log({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      organizer: e.organizer?.email,
    });
  });
}

main().catch(console.error).finally(() => process.exit(0));
