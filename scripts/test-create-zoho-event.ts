import { getValidZohoAccessToken, createZohoEvent } from "../src/lib/zoho-calendar";

/**
 * Script to test creating an event via Zoho Calendar API
 * Run with: npx tsx scripts/test-create-zoho-event.ts <userId> "Event Title" "2026-08-10T10:00:00Z" "2026-08-10T11:00:00Z"
 */
async function main() {
  const [userId, title, startStr, endStr] = process.argv.slice(2);

  if (!userId) {
    console.error("Usage: npx tsx scripts/test-create-zoho-event.ts <userId> [title] [startTime] [endTime]");
    process.exit(1);
  }

  console.log(`[1/3] Fetching valid Zoho token for user ID: ${userId}...`);
  const tokenInfo = await getValidZohoAccessToken(userId);

  if (!tokenInfo || !tokenInfo.calendarUid) {
    console.error("Error: User has no connected Zoho Calendar account or missing primary calendar UID.");
    process.exit(1);
  }

  console.log(`[2/3] Connected to Zoho Calendar (UID: ${tokenInfo.calendarUid}, Domain: ${tokenInfo.apiDomain})`);

  const eventTitle = title ?? "API Test Event";
  const start = startStr ? new Date(startStr) : new Date(Date.now() + 3600000);
  const end = endStr ? new Date(endStr) : new Date(Date.now() + 7200000);

  console.log(`[3/3] Creating event "${eventTitle}" via Zoho Calendar API v1...`);

  const createdEvent = await createZohoEvent(
    tokenInfo.accessToken,
    tokenInfo.apiDomain,
    tokenInfo.calendarUid,
    {
      title: eventTitle,
      description: "Created via Zoho Calendar API test script",
      start,
      end,
      isAllDay: false,
      timezone: "Asia/Kolkata",
      attendeeEmails: [],
    },
  );

  console.log("Success! Event created on Zoho Calendar:");
  console.log(JSON.stringify(createdEvent, null, 2));
}

main().catch((err) => {
  console.error("Failed to create event via Zoho API:", err);
  process.exit(1);
});
