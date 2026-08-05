import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  getValidZohoAccessToken,
  updateZohoEvent,
  deleteZohoEvent,
  getZohoEventById,
} from "@/lib/zoho-calendar";
import { CALENDAR_TIMEZONE } from "@/features/calendar/utils";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Event ID required" }, { status: 400 });

  try {
    // 1. Check DB first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbEvent = await (db as any).calendarEvent.findUnique({
      where: { id },
      include: {
        organizer: { select: { id: true, email: true, name: true } },
        attendees: { select: { id: true, email: true, status: true, userId: true } },
      },
    });

    if (dbEvent) {
      return NextResponse.json({
        success: true,
        source: "database",
        event: dbEvent,
      });
    }

    // 2. Fallback to Zoho Calendar API
    const tokenInfo = await getValidZohoAccessToken(session.user.id);
    if (tokenInfo && tokenInfo.calendarUid) {
      try {
        const zohoEvent = await getZohoEventById(
          tokenInfo.accessToken,
          tokenInfo.apiDomain,
          tokenInfo.calendarUid,
          id,
        );
        if (zohoEvent) {
          return NextResponse.json({
            success: true,
            source: "zoho",
            event: zohoEvent,
          });
        }
      } catch (e) {
        console.warn("[api:zoho:events:id:GET] Zoho fetch error:", e);
      }
    }

    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  } catch (error) {
    console.error("[api:zoho:events:id:GET] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch event" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Event ID required" }, { status: 400 });

  const userId = session.user.id;

  try {
    const body = await request.json();
    const { title, description, start: rawStart, end: rawEnd, isAllDay, etag } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbEvent = await (db as any).calendarEvent.findUnique({
      where: { id },
      include: { attendees: true },
    });

    let updatedEvent = null;
    let zohoSynced = false;

    if (dbEvent) {
      if (dbEvent.organizerId !== userId) {
        return NextResponse.json(
          { error: "Only the organizer can update this event" },
          { status: 403 },
        );
      }

      const updateData: Record<string, unknown> = {};
      if (title !== undefined) updateData.title = String(title).trim();
      if (description !== undefined) updateData.description = String(description).trim();
      if (rawStart !== undefined) updateData.start = new Date(rawStart);
      if (rawEnd !== undefined) updateData.end = new Date(rawEnd);
      if (isAllDay !== undefined) updateData.isAllDay = Boolean(isAllDay);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatedEvent = await (db as any).calendarEvent.update({
        where: { id },
        data: updateData,
        include: {
          organizer: { select: { email: true, name: true } },
          attendees: { select: { email: true, status: true } },
        },
      });
    }

    // Sync to Zoho if connected
    const tokenInfo = await getValidZohoAccessToken(userId);
    if (tokenInfo && tokenInfo.calendarUid) {
      try {
        const start = rawStart ? new Date(rawStart) : dbEvent?.start ?? new Date();
        const end = rawEnd ? new Date(rawEnd) : dbEvent?.end ?? new Date();
        const finalTitle = title ?? dbEvent?.title ?? "Updated Event";
        const finalDesc = description ?? dbEvent?.description ?? "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const attendeeEmails = dbEvent?.attendees?.map((a: any) => a.email) ?? [];

        await updateZohoEvent(
          tokenInfo.accessToken,
          tokenInfo.apiDomain,
          tokenInfo.calendarUid,
          id,
          {
            title: finalTitle,
            description: finalDesc,
            start,
            end,
            isAllDay: isAllDay ?? dbEvent?.isAllDay ?? false,
            timezone: CALENDAR_TIMEZONE,
            attendeeEmails,
          },
          etag ?? 1,
        );
        zohoSynced = true;
      } catch (zohoErr) {
        console.warn("[api:zoho:events:id:PUT] Zoho sync error:", zohoErr);
      }
    }

    revalidatePath("/calendar");
    revalidatePath("/zohocalendar");

    return NextResponse.json({
      success: true,
      event: updatedEvent ?? { id, title, description, start: rawStart, end: rawEnd },
      zohoSynced,
    });
  } catch (error) {
    console.error("[api:zoho:events:id:PUT] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update event" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Event ID required" }, { status: 400 });

  const userId = session.user.id;
  const { searchParams } = request.nextUrl;
  const etagParam = searchParams.get("etag");
  const etag = etagParam ? parseInt(etagParam, 10) : 1;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbEvent = await (db as any).calendarEvent.findUnique({
      where: { id },
    });

    if (dbEvent) {
      if (dbEvent.organizerId !== userId) {
        return NextResponse.json(
          { error: "Only the organizer can delete this event" },
          { status: 403 },
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).calendarEvent.delete({ where: { id } });
    }

    // Also delete from Zoho if connected
    let zohoDeleted = false;
    const tokenInfo = await getValidZohoAccessToken(userId);
    if (tokenInfo && tokenInfo.calendarUid) {
      try {
        await deleteZohoEvent(
          tokenInfo.accessToken,
          tokenInfo.apiDomain,
          tokenInfo.calendarUid,
          id,
          etag,
        );
        zohoDeleted = true;
      } catch (zohoErr) {
        console.warn("[api:zoho:events:id:DELETE] Zoho delete error:", zohoErr);
      }
    }

    revalidatePath("/calendar");
    revalidatePath("/zohocalendar");

    return NextResponse.json({
      success: true,
      message: "Event deleted successfully",
      dbDeleted: Boolean(dbEvent),
      zohoDeleted,
    });
  } catch (error) {
    console.error("[api:zoho:events:id:DELETE] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete event" },
      { status: 500 },
    );
  }
}
