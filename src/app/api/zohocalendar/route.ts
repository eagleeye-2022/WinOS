import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    service: "Zoho Calendar API Interface",
    version: "1.0.0",
    endpoints: {
      status: {
        method: "GET",
        path: "/api/zohocalendar/status",
        description: "Check if the logged-in user has connected their Zoho account.",
      },
      calendars: {
        method: "GET",
        path: "/api/zohocalendar/calendars",
        description: "Fetch list of user's Zoho Calendars directly from Zoho API.",
      },
      listEvents: {
        method: "GET",
        path: "/api/zohocalendar/events?start=ISO_DATE&end=ISO_DATE",
        description: "Fetch events within date range (merged DB & Zoho events).",
      },
      createEvent: {
        method: "POST",
        path: "/api/zohocalendar/events",
        description: "Create a new event in WinOS DB and sync to Zoho Calendar.",
      },
      getEvent: {
        method: "GET",
        path: "/api/zohocalendar/events/:id",
        description: "Get details for a specific event by ID.",
      },
      updateEvent: {
        method: "PUT",
        path: "/api/zohocalendar/events/:id",
        description: "Update an existing event in WinOS DB and Zoho Calendar.",
      },
      deleteEvent: {
        method: "DELETE",
        path: "/api/zohocalendar/events/:id",
        description: "Delete an event from WinOS DB and Zoho Calendar.",
      },
      disconnect: {
        method: "POST",
        path: "/api/zohocalendar/disconnect",
        description: "Disconnect user's Zoho account.",
      },
      oauthLogin: {
        method: "GET",
        path: "/api/auth/zoho/login",
        description: "Initiate OAuth2 login flow with Zoho.",
      },
    },
  });
}
