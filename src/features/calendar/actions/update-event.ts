"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getStr, validateText } from "@/lib/action-utils";
import { getValidZohoAccessToken, updateZohoEvent } from "@/lib/zoho-calendar";
import { CALENDAR_TIMEZONE, fromDateTimeLocalValue } from "../utils";

export type UpdateEventState = {
  errors?: { title?: string[]; start?: string[]; end?: string[] };
  message?: string;
};

const TITLE_MAX = 200;

export async function updateCalendarEvent(
  _prevState: UpdateEventState,
  formData: FormData,
): Promise<UpdateEventState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const eventId = getStr(formData, "eventId");
  if (!eventId) return { message: "Missing eventId" };

  const title = getStr(formData, "title");
  const description = getStr(formData, "description");
  const startStr = getStr(formData, "start");
  const endStr = getStr(formData, "end");
  const isAllDay = getStr(formData, "isAllDay") === "on";
  const participantIds = formData.getAll("participantIds") as string[];
  const previousParticipantIds = new Set(formData.getAll("previousParticipantIds") as string[]);

  const errors: UpdateEventState["errors"] = {};
  errors.title = validateText("Title", title, TITLE_MAX);
  if (!startStr) errors.start = ["Start time is required"];
  if (!endStr) errors.end = ["End time is required"];
  if (errors.title || errors.start || errors.end) return { errors };

  const start = fromDateTimeLocalValue(startStr);
  const end = fromDateTimeLocalValue(endStr);
  if (end <= start) {
    return { errors: { end: ["End time must be after start time"] } };
  }

  const token = await getValidZohoAccessToken(session.user.id);
  if (!token || !token.calendarUid) {
    return { message: "Connect your Zoho Calendar before editing events." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invitees = await (db as any).user.findMany({
    where: { id: { in: participantIds } },
    select: { id: true, email: true },
  });

  await updateZohoEvent(token.accessToken, token.apiDomain, token.calendarUid, eventId, {
    title,
    description,
    start,
    end,
    isAllDay,
    timezone: CALENDAR_TIMEZONE,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    participantEmails: invitees.map((u: any) => u.email),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newlyInvited = invitees.filter((u: any) => !previousParticipantIds.has(u.id));
  if (newlyInvited.length > 0) {
    const organizerId = session.user.id;
    const organizerName = session.user.name ?? session.user.email ?? "A teammate";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).notification.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: newlyInvited.map((u: any) => ({
        type: "CALENDAR_INVITE",
        title: "Calendar Invite",
        message: `${organizerName} invited you to "${title}"`,
        userId: u.id,
        createdById: organizerId,
        relatedEntryId: eventId,
      })),
    });
  }

  revalidatePath("/calendar");
  return { message: "updated" };
}
