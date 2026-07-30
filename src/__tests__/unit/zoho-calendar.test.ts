import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  toZohoDateTimeString,
  ZohoApiError,
  exchangeZohoCodeForToken,
  listZohoCalendars,
  createZohoEvent,
  updateZohoEvent,
  deleteZohoEvent,
} from "@/lib/zoho-calendar";

describe("Zoho Calendar Module Unit Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      CLIENT_ID: "test_client_id",
      CLIENT_SECRET: "test_client_secret",
      ZOHO_REDIRECT_URI: "http://localhost:3000/api/auth/zoho/callback",
      ZOHO_ACCOUNTS_DOMAIN: "accounts.zoho.in",
      ZOHO_API_DOMAIN: "calendar.zoho.in",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("toZohoDateTimeString", () => {
    it("formats Date object into UTC yyyyMMddTHHmmssZ format", () => {
      const date = new Date(Date.UTC(2026, 6, 30, 12, 30, 45));
      const formatted = toZohoDateTimeString(date);
      expect(formatted).toBe("20260730T123045Z");
    });
  });

  describe("ZohoApiError", () => {
    it("stores status and code properly", () => {
      const err = new ZohoApiError("Unauthorized request", 401, "INVALID_TOKEN");
      expect(err.name).toBe("ZohoApiError");
      expect(err.message).toBe("Unauthorized request");
      expect(err.status).toBe(401);
      expect(err.code).toBe("INVALID_TOKEN");
    });
  });

  describe("exchangeZohoCodeForToken", () => {
    it("exchanges authorization code for access & refresh tokens", async () => {
      const mockResponse = {
        access_token: "mock_access_token",
        refresh_token: "mock_refresh_token",
        expires_in: 3600,
        api_domain: "https://calendar.zoho.in",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await exchangeZohoCodeForToken("auth_code_123");

      expect(result).toEqual({
        accessToken: "mock_access_token",
        refreshToken: "mock_refresh_token",
        expiresIn: 3600,
        apiDomain: "calendar.zoho.in",
        accountsDomain: "accounts.zoho.in",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://accounts.zoho.in/oauth/v2/token",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }),
      );
    });

    it("throws ZohoApiError when token exchange fails", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: "invalid_grant",
          error_description: "Code expired",
        }),
      } as Response);

      await expect(exchangeZohoCodeForToken("bad_code")).rejects.toThrow(ZohoApiError);
    });
  });

  describe("Calendar API v1 endpoints", () => {
    it("lists calendars using Zoho-oauthtoken header", async () => {
      const mockCalendars = {
        calendars: [
          { uid: "cal_1", name: "Work", isdefault: true },
          { uid: "cal_2", name: "Personal", isdefault: false },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockCalendars),
      } as Response);

      const calendars = await listZohoCalendars("token_xyz", "calendar.zoho.in");

      expect(calendars).toEqual([
        { uid: "cal_1", name: "Work", isDefault: true },
        { uid: "cal_2", name: "Personal", isDefault: false },
      ]);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://calendar.zoho.in/api/v1/calendars",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Zoho-oauthtoken token_xyz",
          }),
        }),
      );
    });

    it("creates an event with eventdata query param", async () => {
      const mockEvent = {
        events: [
          {
            uid: "evt_100",
            etag: 1,
            title: "Project Sync",
            description: "Weekly sync meeting",
            dateandtime: {
              start: "20260730T140000Z",
              end: "20260730T150000Z",
              timezone: "Asia/Kolkata",
            },
            isallday: false,
            organizer: { email: "organizer@example.com" },
            attendees: [{ email: "dev@example.com", status: "NEEDS-ACTION" }],
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockEvent),
      } as Response);

      const start = new Date("2026-07-30T14:00:00Z");
      const end = new Date("2026-07-30T15:00:00Z");

      const created = await createZohoEvent("token_xyz", "calendar.zoho.in", "cal_1", {
        title: "Project Sync",
        description: "Weekly sync meeting",
        start,
        end,
        isAllDay: false,
        timezone: "Asia/Kolkata",
        attendeeEmails: ["dev@example.com"],
      });

      expect(created.id).toBe("evt_100");
      expect(created.title).toBe("Project Sync");
      expect(created.attendees).toEqual([{ email: "dev@example.com", status: "NEEDS-ACTION" }]);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("https://calendar.zoho.in/api/v1/calendars/cal_1/events?eventdata="),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("updates an event with etag header", async () => {
      const mockEvent = {
        events: [
          {
            uid: "evt_100",
            etag: 2,
            title: "Updated Sync",
            dateandtime: {
              start: "20260730T140000Z",
              end: "20260730T150000Z",
            },
            isallday: false,
            attendees: [],
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockEvent),
      } as Response);

      const updated = await updateZohoEvent(
        "token_xyz",
        "calendar.zoho.in",
        "cal_1",
        "evt_100",
        {
          title: "Updated Sync",
          start: new Date("2026-07-30T14:00:00Z"),
          end: new Date("2026-07-30T15:00:00Z"),
          isAllDay: false,
          timezone: "Asia/Kolkata",
          attendeeEmails: [],
        },
        1,
      );

      expect(updated.etag).toBe(2);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/cal_1/events/evt_100?eventdata="),
        expect.objectContaining({
          method: "PUT",
          headers: expect.objectContaining({
            etag: "1",
          }),
        }),
      );
    });

    it("deletes an event with etag header", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "",
      } as Response);

      await deleteZohoEvent("token_xyz", "calendar.zoho.in", "cal_1", "evt_100", 5);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://calendar.zoho.in/api/v1/calendars/cal_1/events/evt_100",
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({ etag: "5" }),
        }),
      );
    });
  });
});
