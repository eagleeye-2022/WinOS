"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getStr, validateText } from "@/lib/action-utils";
import { getValidZohoAccessToken, createZohoEvent } from "@/lib/zoho-calendar";
import { CALENDAR_TIMEZONE, fromDateTimeLocalValue } from "../utils";

export type CreateEventState = {
  errors?: { title?: string[]; start?: string[]; end?: string[] };
  message?: string;
};

const TITLE_MAX = 200;

export async function createCalendarEvent(
  _prevState: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const userId = session.user.id;
  const organizerEmail = session.user.email ?? "";
  const organizerName = session.user.name ?? session.user.email ?? "A teammate";

  const title = getStr(formData, "title");
  const description = getStr(formData, "description");
  const startStr = getStr(formData, "start");
  const endStr = getStr(formData, "end");
  const isAllDay = getStr(formData, "isAllDay") === "on";
  const location = getStr(formData, "location");
  const meetingType = getStr(formData, "meetingType") || "online";
  const meetingMode = getStr(formData, "meetingMode") || "audio";
  const meetingLink = getStr(formData, "meetingLink");
  const alertType = getStr(formData, "alertType") || "zia";
  const isRecording = getStr(formData, "isRecording") === "true";
  const participantIds = formData.getAll("participantIds") as string[];

  const errors: CreateEventState["errors"] = {};
  errors.title = validateText("Title", title, TITLE_MAX);
  if (!startStr) errors.start = ["Start time is required"];
  if (!endStr) errors.end = ["End time is required"];
  if (errors.title || errors.start || errors.end) return { errors };

  const start = fromDateTimeLocalValue(startStr);
  const end = fromDateTimeLocalValue(endStr);
  if (end <= start) {
    return { errors: { end: ["End time must be after start time"] } };
  }

  // 1. Fetch assigned invitee users from DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invitees = await (db as any).user.findMany({
    where: { id: { in: participantIds } },
    select: { id: true, email: true },
  });

  // Build attendees array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attendeeData: any[] = [
    {
      userId: userId,
      email: organizerEmail,
      status: "ACCEPTED",
      role: "ORGANIZER",
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invitees.forEach((u: any) => {
    if (u.id !== userId) {
      attendeeData.push({
        userId: u.id,
        email: u.email,
        status: "NEEDS_ACTION",
        role: "PARTICIPANT",
      });
    }
  });

  // 2. Save event in PostgreSQL Database for cross-user collaboration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createdDbEvent = await (db as any).calendarEvent.create({
    data: {
      title,
      description,
      location,
      meetingType,
      meetingMode,
      isRecording,
      meetingLink,
      alertType,
      start,
      end,
      isAllDay,
      organizerId: userId,
      attendees: {
        createMany: {
          data: attendeeData,
        },
      },
    },
  });

  // 3. Send notifications to invited participants
  if (invitees.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).notification.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: invitees
        .filter((u: any) => u.id !== userId)
        .map((u: any) => ({
          type: "CALENDAR_INVITE",
          title: "Calendar Invite",
          message: `${organizerName} invited you to "${title}"`,
          userId: u.id,
          createdById: userId,
          relatedEntryId: createdDbEvent.id,
        })),
    });
  }

  // 4. Optionally sync with Zoho Calendar if user connected Zoho
  try {
    const token = await getValidZohoAccessToken(userId);
    if (token && token.calendarUid) {
      await createZohoEvent(token.accessToken, token.apiDomain, token.calendarUid, {
        title,
        description,
        start,
        end,
        isAllDay,
        timezone: CALENDAR_TIMEZONE,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        attendeeEmails: invitees.map((u: any) => u.email),
      });
    }
  } catch (err) {
    console.warn("[calendar] Zoho sync skipped/failed:", err);
  }

  revalidatePath("/calendar");
  return { message: "created" };
}

