import crypto from "crypto";

// ── Stateless signed timesheet share token (no DB storage needed) ─────────────
// The URL carries `userId|date|expiresAt`, signed with the auth secret, so the
// public page can trust it without a lookup table and nobody can edit the URL
// to view another user's or another day's logs.

const SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-timesheet-share-secret";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type TimesheetSharePayload = {
  userId: string;
  /** YYYY-MM-DD */
  date: string;
  /** Epoch ms, or null when the link never expires. */
  expiresAt: number | null;
};

function sign(payload: string): string {
  // Domain-separated from other HMAC uses of the same secret (e.g. CAPTCHA).
  return crypto.createHmac("sha256", SECRET).update(`timesheet-share:${payload}`).digest("base64url");
}

export function issueTimesheetShareToken({ userId, date, expiresAt }: TimesheetSharePayload): string {
  const payload = `${userId}|${date}|${expiresAt ?? 0}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export type TimesheetShareTokenResult =
  | { status: "ok"; payload: TimesheetSharePayload }
  | { status: "invalid" | "expired" };

export function verifyTimesheetShareToken(token: string | null | undefined): TimesheetShareTokenResult {
  if (!token) return { status: "invalid" };

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return { status: "invalid" };

  const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(sign(payload));
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { status: "invalid" };
  }

  const [userId, date, expiresAtRaw] = payload.split("|");
  const expiresAt = Number(expiresAtRaw);
  if (!userId || !DATE_RE.test(date ?? "") || !Number.isFinite(expiresAt)) return { status: "invalid" };
  if (expiresAt > 0 && Date.now() > expiresAt) return { status: "expired" };

  return { status: "ok", payload: { userId, date, expiresAt: expiresAt > 0 ? expiresAt : null } };
}
