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
  const supportNeedId = getStr(formData, "supportNeedId");

  // 0. If this event was scheduled from a support-need row, unlink it first.
  if (supportNeedId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).standupSupportNeed.update({
        where: { id: supportNeedId },
        data: { eventId: null },
      });
      revalidatePath("/support");
      revalidatePath("/dsm");
      revalidatePath("/dsm/all");
      revalidatePath("/dsm/my");
      revalidatePath("/dsm/member", "layout");
    } catch (err) {
      console.warn("[calendar:delete] Failed to unlink support need:", err);
    }
  }

  if (!eventId) return { message: "deleted" };

  console.log(`[calendar:delete] Deleting event ID: ${eventId}...`);

  // 1. Delete DB event
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (db as any).calendarEvent.deleteMany({
      where: { id: eventId },
    });
    console.log(`[calendar:delete] DB delete count: ${res.count}`);
  } catch (err) {
    console.warn("[calendar:delete] DB event delete error:", err);
  }

  // 2. Delete from Zoho if connected
  try {
    const etagStr = getStr(formData, "etag");
    const etagNum = etagStr ? Number(etagStr) : 1;
    const token = await getValidZohoAccessToken(session.user.id);
    if (token && token.calendarUid) {
      console.log(`[calendar:delete] Deleting event ${eventId} from Zoho Calendar (UID: ${token.calendarUid})...`);
      await deleteZohoEvent(token.accessToken, token.apiDomain, token.calendarUid, eventId, isNaN(etagNum) ? 1 : etagNum);
      console.log(`[calendar:delete] Successfully deleted event from Zoho Calendar`);
    }
  } catch (err) {
    console.warn("[calendar:delete] Zoho delete error:", err);
  }

  revalidatePath("/calendar");
  revalidatePath("/zohocalendar");
  return { message: "deleted" };
}

