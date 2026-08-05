import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCalendarEvents } from "@/features/calendar/queries";
import { getValidZohoAccessToken, createZohoEvent } from "@/lib/zoho-calendar";
import { sendCalendarInviteEmail } from "@/lib/email";
import { CALENDAR_TIMEZONE } from "@/features/calendar/utils";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  let rangeStart: Date;
  let rangeEnd: Date;

  if (startParam && endParam) {
    rangeStart = new Date(startParam);
    rangeEnd = new Date(endParam);
  } else {
    // Default range: 7 days ago to 30 days ahead
    const now = new Date();
    rangeStart = new Date(now);
    rangeStart.setDate(rangeStart.getDate() - 7);
    rangeEnd = new Date(now);
    rangeEnd.setDate(rangeEnd.getDate() + 30);
  }

  if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
    return NextResponse.json(
      { error: "Invalid date format. Use ISO format (e.g. 2026-08-04T00:00:00Z)." },
      { status: 400 },
    );
  }

  try {
    const events = await getCalendarEvents(rangeStart, rangeEnd);
    return NextResponse.json({
      success: true,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      count: events.length,
      events,
    });
  } catch (error) {
    console.error("[api:zoho:events:GET] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch events" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const organizerEmail = session.user.email ?? "";
  const organizerName = session.user.name ?? session.user.email ?? "A teammate";

  try {
    const body = await request.json();
    const {
      title,
      description = "",
      start: rawStart,
      end: rawEnd,
      isAllDay = false,
      location = "",
      meetingType = "online",
      meetingMode = "audio",
      meetingLink = "",
      alertType = "zia",
      isRecording = false,
      attendees: rawAttendees = [],
      attendeeEmails: rawAttendeeEmails = [],
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!rawStart || !rawEnd) {
      return NextResponse.json({ error: "Start and End dates are required" }, { status: 400 });
    }

    const start = new Date(rawStart);
    const end = new Date(rawEnd);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid start or end date format" }, { status: 400 });
    }
    if (end <= start) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    // Collect all attendee emails
    const allAssignedEmails = new Set<string>();
    if (Array.isArray(rawAttendeeEmails)) {
      rawAttendeeEmails.forEach((email: unknown) => {
        if (typeof email === "string" && email.trim()) {
          allAssignedEmails.add(email.trim().toLowerCase());
        }
      });
    }
    if (Array.isArray(rawAttendees)) {
      rawAttendees.forEach((att: unknown) => {
        if (typeof att === "string" && att.trim()) {
          allAssignedEmails.add(att.trim().toLowerCase());
        } else if (typeof att === "object" && att !== null && "email" in att) {
          const email = (att as { email?: string }).email;
          if (email && email.trim()) allAssignedEmails.add(email.trim().toLowerCase());
        }
      });
    }

    // Match users from DB
    const inviteeUsers: Array<{ id: string; email: string }> = allAssignedEmails.size > 0
      ? await (db as unknown as { user: { findMany: (args: unknown) => Promise<Array<{ id: string; email: string }>> } }).user.findMany({
          where: { email: { in: Array.from(allAssignedEmails) } },
          select: { id: true, email: true },
        })
      : [];

    const attendeeDataMap = new Map<string, { userId: string | null; email: string; status: string; role: string }>();
    attendeeDataMap.set(organizerEmail.toLowerCase(), {
      userId,
      email: organizerEmail,
      status: "ACCEPTED",
      role: "ORGANIZER",
    });

    inviteeUsers.forEach((u) => {
      if (u.id !== userId) {
        attendeeDataMap.set(u.email.toLowerCase(), {
          userId: u.id,
          email: u.email,
          status: "NEEDS_ACTION",
          role: "ATTENDEE",
        });
      }
    });

    allAssignedEmails.forEach((email) => {
      if (!attendeeDataMap.has(email)) {
        attendeeDataMap.set(email, {
          userId: null,
          email,
          status: "NEEDS_ACTION",
          role: "ATTENDEE",
        });
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = await (db as any).calendarEvent.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        start,
        end,
        isAllDay: Boolean(isAllDay),
        organizerId: userId,
        attendees: {
          create: Array.from(attendeeDataMap.values()),
        },
      },
      include: {
        organizer: { select: { email: true, name: true } },
        attendees: { select: { email: true, status: true, userId: true } },
      },
    });

    // Send emails
    Array.from(attendeeDataMap.values()).forEach((att) => {
      if (att.role !== "ORGANIZER" && att.email) {
        sendCalendarInviteEmail({
          to: att.email,
          organizerName,
          organizerEmail,
          title: event.title,
          description: event.description,
          start: event.start,
          end: event.end,
        }).catch((err) => console.error("[api:zoho:events] failed email:", err));
      }
    });

    // Sync to Zoho Calendar if connected
    let zohoSynced = false;
    let zohoEventId: string | null = null;

    try {
      const tokenInfo = await getValidZohoAccessToken(userId);
      if (tokenInfo && tokenInfo.calendarUid) {
        const zohoRes = await createZohoEvent(
          tokenInfo.accessToken,
          tokenInfo.apiDomain,
          tokenInfo.calendarUid,
          {
            title: event.title,
            description: event.description,
            start: event.start,
            end: event.end,
            isAllDay: event.isAllDay,
            timezone: CALENDAR_TIMEZONE,
            attendeeEmails: Array.from(attendeeDataMap.keys()),
          },
        );
        zohoSynced = true;
        zohoEventId = zohoRes.id;
      }
    } catch (zohoErr) {
      console.warn("[api:zoho:events] Zoho sync skipped/failed:", zohoErr);
    }

    revalidatePath("/calendar");
    revalidatePath("/zohocalendar");

    return NextResponse.json(
      {
        success: true,
        event: {
          id: event.id,
          title: event.title,
          description: event.description,
          start: event.start,
          end: event.end,
          isAllDay: event.isAllDay,
          organizerEmail: event.organizer?.email ?? organizerEmail,
          attendees: event.attendees,
        },
        zohoSynced,
        zohoEventId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api:zoho:events:POST] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create event" },
      { status: 500 },
    );
  }
}
