"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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

  // Delete DB event
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).calendarEvent.deleteMany({
      where: { id: eventId },
    });
  } catch (err) {
    console.warn("[calendar] DB event delete skipped or failed:", err);
  }

  // Delete from Zoho if connected
  try {
    const etagStr = getStr(formData, "etag");
    const token = await getValidZohoAccessToken(session.user.id);
    if (token && token.calendarUid && etagStr) {
      await deleteZohoEvent(token.accessToken, token.apiDomain, token.calendarUid, eventId, Number(etagStr));
    }
  } catch (err) {
    console.warn("[calendar] Zoho delete skipped or failed:", err);
  }

  revalidatePath("/calendar");
  return { message: "deleted" };
}

