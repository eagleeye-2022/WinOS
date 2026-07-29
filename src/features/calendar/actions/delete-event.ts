"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getStr } from "@/lib/action-utils";
import { getValidZohoAccessToken, deleteZohoEvent } from "@/lib/zoho-calendar";

export type DeleteEventState = {
  message?: string;
};

export async function deleteCalendarEvent(
  _prevState: DeleteEventState,
  formData: FormData,
): Promise<DeleteEventState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const eventId = getStr(formData, "eventId");
  if (!eventId) return { message: "Missing eventId" };

  const token = await getValidZohoAccessToken(session.user.id);
  if (!token || !token.calendarUid) {
    return { message: "Connect your Zoho Calendar before deleting events." };
  }

  await deleteZohoEvent(token.accessToken, token.apiDomain, token.calendarUid, eventId);

  revalidatePath("/calendar");
  return { message: "deleted" };
}
