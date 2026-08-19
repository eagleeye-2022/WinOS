"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getStr } from "@/lib/action-utils";
import { getValidZohoAccessToken, respondToZohoEvent } from "@/lib/zoho-calendar";

export type RespondToInviteState = {
  message?: string;
};

export async function respondToCalendarInvite(
  _prevState: RespondToInviteState,
  formData: FormData,
): Promise<RespondToInviteState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const eventId = getStr(formData, "eventId");
  const response = getStr(formData, "response");
  if (!eventId || (response !== "accept" && response !== "decline" && response !== "tentative")) {
    return { message: "Invalid request" };
  }

  const userId = session.user.id;
  const userEmail = session.user.email ?? "";
  const newStatus = response === "accept" ? "ACCEPTED" : response === "decline" ? "DECLINED" : "TENTATIVE";

  // Update DB Attendee status
  try {
    const OR_conditions: Array<Record<string, unknown>> = [{ userId }];
    if (userEmail) {
      OR_conditions.push({ email: userEmail });
      OR_conditions.push({ email: userEmail.toLowerCase() });
      OR_conditions.push({ email: { equals: userEmail, mode: "insensitive" } });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).calendarEventAttendee.updateMany({
      where: {
        eventId,
        OR: OR_conditions,
      },
      data: {
        status: newStatus,
        userId,
      },
    });
  } catch (err) {
    console.warn("[calendar] DB RSVP update skipped or failed:", err);
  }

  // Update Zoho Calendar if connected
  try {
    const token = await getValidZohoAccessToken(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbEvent = await (db as any).calendarEvent.findUnique({
      where: { id: eventId },
      select: { zohoEventId: true },
    });
    if (token && token.calendarUid && userEmail && dbEvent?.zohoEventId) {
      await respondToZohoEvent(
        token.accessToken,
        token.apiDomain,
        token.calendarUid,
        dbEvent.zohoEventId,
        userEmail,
        response,
      );
    }
  } catch (err) {
    console.warn("[calendar] Zoho RSVP skipped or failed:", err);
  }

  revalidatePath("/calendar");
  revalidatePath("/zohocalendar");
  return { message: "responded" };
}

