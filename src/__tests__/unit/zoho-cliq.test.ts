import { describe, it, expect, vi, afterEach } from "vitest";
import { postToCliq } from "@/lib/zoho-cliq";

describe("postToCliq", () => {
  const original = process.env.ZOHO_CLIQ_WEBHOOK_URL;

  afterEach(() => {
    process.env.ZOHO_CLIQ_WEBHOOK_URL = original;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("logs instead of posting when the webhook isn't configured", async () => {
    delete process.env.ZOHO_CLIQ_WEBHOOK_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "log").mockImplementation(() => { });

    const res = await postToCliq({ text: "hello" });

    expect(res).toEqual({ ok: true, logged: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(log.mock.calls[0][0]).toContain("hello");
  });

  it("POSTs the message as JSON to the webhook", async () => {
    process.env.ZOHO_CLIQ_WEBHOOK_URL = "https://cliq.zoho.in/api/v2/channelsbyname/reports/message?zapikey=k";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await postToCliq({ text: "hello" });

    expect(res).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(process.env.ZOHO_CLIQ_WEBHOOK_URL);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ text: "hello" });
  });

  it("returns an error (doesn't throw) on a non-2xx response", async () => {
    process.env.ZOHO_CLIQ_WEBHOOK_URL = "https://cliq.zoho.in/hook";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad key", { status: 401 })));

    const res = await postToCliq({ text: "x" });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("401");
  });

  it("returns an error (doesn't throw) on a network failure", async () => {
    process.env.ZOHO_CLIQ_WEBHOOK_URL = "https://cliq.zoho.in/hook";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));

    const res = await postToCliq({ text: "x" });

    expect(res).toEqual({ ok: false, error: "ECONNRESET" });
  });
});
