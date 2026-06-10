"use server";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import {
  generateOtp,
  storeOtp,
  validateOtp,
  checkEmailRateLimit,
} from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";
import { logOtp } from "@/lib/logger";
import { fmtWait } from "@/lib/fmt";
import { ROUTES } from "@/constants/routes";

const COMPANY_DOMAIN = "eagleeyedigital.io";

// ── Prisma error helpers ──────────────────────────────────────────────────────

// Checks whether err is a Prisma infrastructure error (DB unreachable or
// schema not pushed). These are expected setup failures, not app bugs.
function isPrismaInfraError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string; errorCode?: string };
  const code = e.code ?? e.errorCode;
  // P1001/ECONNREFUSED: can't reach DB  P1017: server closed connection
  // P2021: table missing               P2022: column missing
  return typeof code === "string" &&
    ["P1001", "P1017", "P2021", "P2022", "ECONNREFUSED"].includes(code);
}

// Dev-only: logs Prisma error details with actionable hints to the server console.
function devLogPrismaError(context: string, err: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  const e = err as { code?: string; errorCode?: string; message?: string };
  const code = e.code ?? e.errorCode ?? "unknown";
  const hints: Record<string, string> = {
    ECONNREFUSED: "DB is not running → run: npm run db:restart",
    P1001: "DB is unreachable → run: npm run db:restart",
    P1017: "DB closed the connection → run: npm run db:restart",
    P2021: "Table does not exist → run: npx prisma db push",
    P2022: "Column does not exist → run: npx prisma db push",
  };
  const hint = hints[code] ?? "Check DB connection and schema.";
  console.error(`[auth:${context}] Prisma ${code}: ${hint}`);
  console.error(`[auth:${context}] detail: ${e.message ?? String(err)}`);
}

const SERVICE_UNAVAILABLE =
  "The login service is temporarily unavailable. Please try again shortly.";

// ── Step 1 — Request OTP ──────────────────────────────────────────────────────

export type RequestOtpState = {
  step: "email" | "otp";
  email?: string;
  error?: string;
  /** Dev mode only: visible in the UI when SMTP is not configured.
   *  Guaranteed undefined when NODE_ENV === "production". */
  devOtp?: string;
  /** True when this was a resend (the OTP screen was already showing). */
  resent?: boolean;
  /** Seconds until the next OTP request is allowed (rate-limited response). */
  rateLimitWaitSeconds?: number;
};

export async function requestOtpAction(
  _prev: RequestOtpState,
  formData: FormData,
): Promise<RequestOtpState> {
  const email = ((formData.get("email") as string) ?? "").trim().toLowerCase();

  if (!email) return { step: "email", error: "Email is required." };

  if (!email.endsWith(`@${COMPANY_DOMAIN}`)) {
    return {
      step: "email",
      error: "Only @eagleeyedigital.io email addresses are allowed.",
    };
  }

  // Rate limit check — per-email cooldown + rolling hourly window.
  let rateLimit: Awaited<ReturnType<typeof checkEmailRateLimit>>;
  try {
    rateLimit = await checkEmailRateLimit(email);
  } catch (err) {
    devLogPrismaError("checkEmailRateLimit", err);
    return { step: "email", error: SERVICE_UNAVAILABLE };
  }

  if (!rateLimit.allowed) {
    logOtp("otp.rate_limited", email, { waitSeconds: rateLimit.waitSeconds });
    const isAlreadyOnOtpStep = _prev.step === "otp" && _prev.email === email;
    return {
      step: isAlreadyOnOtpStep ? "otp" : "email",
      email: isAlreadyOnOtpStep ? email : undefined,
      error: `Please wait ${fmtWait(rateLimit.waitSeconds)} before requesting a new code.`,
      rateLimitWaitSeconds: rateLimit.waitSeconds,
    };
  }

  const otp = generateOtp();
  try {
    await storeOtp(email, otp);
  } catch (err) {
    devLogPrismaError("storeOtp", err);
    return { step: "email", error: SERVICE_UNAVAILABLE };
  }
  logOtp("otp.requested", email);

  try {
    await sendOtpEmail(email, otp);
    logOtp("otp.sent", email);
  } catch (err) {
    logOtp("otp.send_failed", email, { error: String(err) });
    return {
      step: "email",
      error: "Failed to send the verification code. Please try again.",
    };
  }

  const isResend = _prev.step === "otp" && _prev.email === email;
  // Dev-mode hint: only when SMTP is absent AND not in production.
  const devOtp =
    !process.env.SMTP_HOST && process.env.NODE_ENV !== "production"
      ? otp
      : undefined;

  return { step: "otp", email, devOtp, resent: isResend };
}

// ── Step 2 — Verify OTP ───────────────────────────────────────────────────────

export async function verifyOtpAction(
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const email = ((formData.get("email") as string) ?? "").trim().toLowerCase();
  const otp = ((formData.get("otp") as string) ?? "").trim();

  if (!email || !otp) return "Missing email or code.";

  // Validate first — this gives us specific failure reasons and updates
  // attempt counters, without yet consuming the token.
  let check: Awaited<ReturnType<typeof validateOtp>>;
  try {
    check = await validateOtp(email, otp);
  } catch (err) {
    devLogPrismaError("validateOtp", err);
    return SERVICE_UNAVAILABLE.replace("shortly.", "shortly. Please request a new code.");
  }

  if (!check.ok) {
    switch (check.reason) {
      case "not_found":
        return "No active code found for this email. Please request a new one.";
      case "expired":
        return "Your code has expired (10-minute limit). Please request a new one.";
      case "wrong_code": {
        const left = check.attemptsLeft;
        return left <= 1
          ? `Incorrect code — 1 attempt remaining before your code is invalidated.`
          : `Incorrect code. ${left} attempts remaining.`;
      }
      case "max_attempts":
        return "Too many incorrect attempts — your code has been invalidated. Click 'Resend code' to get a new one.";
    }
  }

  try {
    // signIn calls authorize → verifyAndConsumeOtp (final consumption).
    // Redirect to home; page.tsx handles role-based routing (MANAGER → /dashboard, TEAM_MEMBER → /dsm/my).
    await signIn("credentials", { email, otp, redirectTo: ROUTES.home });
  } catch (error) {
    if (error instanceof AuthError) {
      logOtp("otp.invalid", email, { stage: "signIn" });
      return "Sign-in failed. Please request a new code.";
    }
    if (isPrismaInfraError(error)) {
      devLogPrismaError("signIn/authorize", error);
      return SERVICE_UNAVAILABLE.replace("shortly.", "shortly. Please request a new code.");
    }
    // Re-throw Next.js redirects so they propagate correctly.
    throw error;
  }
}
