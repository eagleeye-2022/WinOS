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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).calendarEventAttendee.updateMany({
      where: {
        eventId,
        OR: [
          { userId },
          ...(userEmail ? [{ email: userEmail }] : []),
        ],
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
    if (token && token.calendarUid && userEmail) {
      await respondToZohoEvent(
        token.accessToken,
        token.apiDomain,
        token.calendarUid,
        eventId,
        userEmail,
        response,
      );
    }
  } catch (err) {
    console.warn("[calendar] Zoho RSVP skipped or failed:", err);
  }

  revalidatePath("/calendar");
  return { message: "responded" };
}

