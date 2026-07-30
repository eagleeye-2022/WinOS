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

  const title = getStr(formData, "title");
  const description = getStr(formData, "description");
  const startStr = getStr(formData, "start");
  const endStr = getStr(formData, "end");
  const isAllDay = getStr(formData, "isAllDay") === "on";
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

  const token = await getValidZohoAccessToken(session.user.id);
  if (!token || !token.calendarUid) {
    return { message: "Connect your Zoho Calendar before creating events." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invitees = await (db as any).user.findMany({
    where: { id: { in: participantIds } },
    select: { id: true, email: true },
  });

  const zohoEvent = await createZohoEvent(token.accessToken, token.apiDomain, token.calendarUid, {
    title,
    description,
    start,
    end,
    isAllDay,
    timezone: CALENDAR_TIMEZONE,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attendeeEmails: invitees.map((u: any) => u.email),
  });

  if (invitees.length > 0) {
    const organizerId = session.user.id;
    const organizerName = session.user.name ?? session.user.email ?? "A teammate";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).notification.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: invitees.map((u: any) => ({
        type: "CALENDAR_INVITE",
        title: "Calendar Invite",
        message: `${organizerName} invited you to "${title}"`,
        userId: u.id,
        createdById: organizerId,
        relatedEntryId: zohoEvent.id,
      })),
    });
  }

  revalidatePath("/calendar");
  return { message: "created" };
}
