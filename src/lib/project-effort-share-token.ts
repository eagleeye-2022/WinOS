import crypto from "crypto";

// ── Stateless signed project effort-log share token (no DB storage needed) ────
// Same idea as timesheet-share-token.ts, for a whole project over a date range:
// the URL carries `projectId|sharedBy|scope|from|to|expiresAt`, signed with the
// auth secret, so nobody can edit it to see another project, person or period.

const SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-timesheet-share-secret";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ProjectEffortShareScope = "all" | "own";

export type ProjectEffortSharePayload = {
  projectId: string;
  /** User who created the link — deactivating them kills the link. */
  sharedBy: string;
  /** "all" = every member's logs (managers / project owner); "own" = only sharedBy's logs. */
  scope: ProjectEffortShareScope;
  /** YYYY-MM-DD, inclusive */
  from: string;
  /** YYYY-MM-DD, inclusive */
  to: string;
  /** Epoch ms, or null when the link never expires. */
  expiresAt: number | null;
};

function sign(payload: string): string {
  // Domain-separated from the per-day timesheet link and other HMAC uses of the same secret.
  return crypto.createHmac("sha256", SECRET).update(`project-effort-share:${payload}`).digest("base64url");
}

export function issueProjectEffortShareToken(p: ProjectEffortSharePayload): string {
  const payload = [p.projectId, p.sharedBy, p.scope, p.from, p.to, p.expiresAt ?? 0].join("|");
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export type ProjectEffortShareTokenResult =
  | { status: "ok"; payload: ProjectEffortSharePayload }
  | { status: "invalid" | "expired" };

export function verifyProjectEffortShareToken(token: string | null | undefined): ProjectEffortShareTokenResult {
  if (!token) return { status: "invalid" };

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return { status: "invalid" };

  const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(sign(payload));
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { status: "invalid" };
  }

  const [projectId, sharedBy, scope, from, to, expiresAtRaw] = payload.split("|");
  const expiresAt = Number(expiresAtRaw);
  if (
    !projectId ||
    !sharedBy ||
    (scope !== "all" && scope !== "own") ||
    !DATE_RE.test(from ?? "") ||
    !DATE_RE.test(to ?? "") ||
    from > to ||
    !Number.isFinite(expiresAt)
  ) {
    return { status: "invalid" };
  }
  if (expiresAt > 0 && Date.now() > expiresAt) return { status: "expired" };

  return {
    status: "ok",
    payload: { projectId, sharedBy, scope, from, to, expiresAt: expiresAt > 0 ? expiresAt : null },
  };
}
