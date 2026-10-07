// Posts end-of-day reports to a Zoho Cliq channel through an incoming webhook.
//
// Env:
//   ZOHO_CLIQ_WEBHOOK_URL — full channel webhook URL including the zapikey, e.g.
//     https://cliq.zoho.in/api/v2/channelsbyname/<channel>/message?zapikey=<key>
//   APP_BASE_URL / NEXTAUTH_URL / AUTH_URL — used to build the "Full report" link (optional)
//
// When ZOHO_CLIQ_WEBHOOK_URL is unset the message is printed to the server console instead (same
// pattern as OTP without SMTP), so local development needs no Cliq setup.

export type CliqPostResult = { ok: true; logged?: boolean } | { ok: false; error: string };

export function getAppBaseUrl(): string | null {
  const raw = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? process.env.AUTH_URL;
  return raw ? raw.replace(/\/+$/, "") : null;
}

export async function postToCliq(message: { text: string }): Promise<CliqPostResult> {
  const webhookUrl = process.env.ZOHO_CLIQ_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.log("\n[zoho-cliq] ZOHO_CLIQ_WEBHOOK_URL not set — message not posted:\n" + message.text + "\n");
    return { ok: true, logged: true };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Cliq responded ${res.status}${body ? `: ${body.slice(0, 300)}` : ""}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
