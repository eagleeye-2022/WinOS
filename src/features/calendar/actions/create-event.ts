"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getStr, validateText } from "@/lib/action-utils";
import { getValidZohoAccessToken, createZohoEvent } from "@/lib/zoho-calendar";
import { sendCalendarInviteEmail } from "@/lib/email";
import { CALENDAR_TIMEZONE, fromDateTimeLocalValue, toTitleCase } from "../utils";

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

  const title = toTitleCase(getStr(formData, "title"));
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
  const rawParticipantEmail = getStr(formData, "participantEmail");
  const rawParticipantEmails = formData.getAll("participantEmails") as string[];

  const allAssignedEmails = new Set<string>();
  if (rawParticipantEmail) allAssignedEmails.add(rawParticipantEmail.trim().toLowerCase());
  rawParticipantEmails.forEach((e) => {
    if (e) allAssignedEmails.add(e.trim().toLowerCase());
  });

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

  // 1. Fetch assigned invitee users from DB matching either IDs or emails
  const OR_conditions: Array<Record<string, unknown>> = [];
  if (participantIds.length > 0) OR_conditions.push({ id: { in: participantIds } });
  if (allAssignedEmails.size > 0) OR_conditions.push({ email: { in: Array.from(allAssignedEmails) } });

   
  const invitees = OR_conditions.length > 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (db as any).user.findMany({
        where: { OR: OR_conditions },
        select: { id: true, email: true },
      })
    : [];

  // Build attendees array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attendeeDataMap = new Map<string, any>();

  // Add Organizer
  attendeeDataMap.set(organizerEmail.toLowerCase(), {
    userId: userId,
    email: organizerEmail,
    status: "ACCEPTED",
    role: "ORGANIZER",
  });

  // Add Registered Users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invitees.forEach((u: any) => {
    if (u.id !== userId) {
      attendeeDataMap.set(u.email.toLowerCase(), {
        userId: u.id,
        email: u.email,
        status: "NEEDS_ACTION",
        role: "PARTICIPANT",
      });
    }
  });

  // Add any typed email addresses that aren't registered yet so events appear when they register
  allAssignedEmails.forEach((emailStr) => {
    if (!attendeeDataMap.has(emailStr) && emailStr !== organizerEmail.toLowerCase()) {
      attendeeDataMap.set(emailStr, {
        userId: null,
        email: emailStr,
        status: "NEEDS_ACTION",
        role: "PARTICIPANT",
      });
    }
  });

  const attendeeData = Array.from(attendeeDataMap.values());

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

  // 3. Send notifications & emails to invited participants
  if (invitees.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).notification.createMany({
       
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: invitees
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((u: any) => u.id !== userId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Send invitation email to every assigned attendee
  const targetEmails = Array.from(attendeeDataMap.keys()).filter(
    (email) => email.toLowerCase() !== organizerEmail.toLowerCase(),
  );

  targetEmails.forEach((emailTo) => {
    void sendCalendarInviteEmail({
      to: emailTo,
      organizerName,
      organizerEmail,
      title,
      description,
      start,
      end,
      meetingLink,
      location,
    }).catch((err) => console.error(`[calendar] Failed to send email to ${emailTo}:`, err));
  });

  // 4. Optionally sync with Zoho Calendar if user connected Zoho
  try {
    const token = await getValidZohoAccessToken(userId);
    if (token && token.calendarUid) {
      console.log(`[calendar] Syncing event "${title}" to Zoho Calendar (UID: ${token.calendarUid})...`);
      const zohoRes = await createZohoEvent(token.accessToken, token.apiDomain, token.calendarUid, {
        title,
        description,
        start,
        end,
        isAllDay,
        timezone: CALENDAR_TIMEZONE,
        attendeeEmails: Array.from(attendeeDataMap.keys()),
      });
      console.log(`[calendar] Successfully created Zoho event ID: ${zohoRes.id}`);
    } else {
      console.warn(`[calendar] Zoho sync skipped for user ${userId}: No valid token or primary calendarUid found.`);
    }
  } catch (err) {
    console.error("[calendar] Zoho sync failed:", err);
  }

  revalidatePath("/calendar");
  revalidatePath("/zohocalendar");
  return { message: "created" };
}



