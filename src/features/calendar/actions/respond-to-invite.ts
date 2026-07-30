"use server";

import { auth } from "@/lib/auth";
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

  if (!session.user.email) return { message: "Missing account email" };

  const token = await getValidZohoAccessToken(session.user.id);
  if (!token || !token.calendarUid) {
    // Invitee hasn't connected their own Zoho account — can't RSVP via Zoho,
    // but the in-app notification can still be dismissed by the caller.
    return { message: "connect_required" };
  }

  await respondToZohoEvent(
    token.accessToken,
    token.apiDomain,
    token.calendarUid,
    eventId,
    session.user.email,
    response,
  );

  revalidatePath("/calendar");
  return { message: "responded" };
}
