"use client";

import { useActionState, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import {
  requestOtpAction,
  verifyOtpAction,
  type RequestOtpState,
} from "@/features/auth/actions/login";
import type { Captcha } from "@/lib/captcha";

export function LoginForm({
  error,
  captcha,
}: {
  error?: string;
  captcha: Captcha;
}) {
  const INITIAL_STATE: RequestOtpState = { step: "email", captcha };
  const [otpState, requestOtp, otpPending] = useActionState(
    requestOtpAction,
    INITIAL_STATE,
  );
  const [verifyError, verifyOtp, verifyPending] = useActionState(
    verifyOtpAction,
    undefined,
  );

  // Manual refresh (via the button) overrides the action's CAPTCHA until the
  // action itself returns a new one (wrong answer, rate limit, etc.), at
  // which point that newer CAPTCHA should win again.
  const [manualCaptcha, setManualCaptcha] = useState<Captcha | null>(null);
  const [lastActionCaptcha, setLastActionCaptcha] = useState(otpState.captcha);
  if (otpState.captcha !== lastActionCaptcha) {
    setLastActionCaptcha(otpState.captcha);
    setManualCaptcha(null);
  }
  const activeCaptcha = manualCaptcha ?? otpState.captcha ?? captcha;

  const [captchaLoading, setCaptchaLoading] = useState(false);
  async function refreshCaptcha() {
    setCaptchaLoading(true);
    try {
      const res = await fetch("/api/captcha");
      const fresh: Captcha = await res.json();
      setManualCaptcha(fresh);
    } finally {
      setCaptchaLoading(false);
    }
  }

  const isPending = otpPending || verifyPending;

  if (otpState.step === "otp" && otpState.email) {
    // Hide verifyError after a successful resend so the "sent" confirmation
    // isn't drowned out by a previous failed-attempt message.
    const errorMsg = otpState.resent
      ? otpState.error
      : (verifyError ?? otpState.error);

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Enter the 6-Digit Code Sent to{" "}
          <strong className="text-foreground">{otpState.email}</strong>.
        </p>

        {errorMsg && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMsg}
          </p>
        )}

        {otpState.resent && !errorMsg && (
          <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            A New Code Was Sent.
          </p>
        )}

        {otpState.devOtp && (
          <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            Dev — OTP: <strong>{otpState.devOtp}</strong>
          </p>
        )}

        <form action={verifyOtp} className="flex flex-col gap-3">
          <input type="hidden" name="email" value={otpState.email} />
          <div>
            <label htmlFor="otp" className="mb-1 block text-sm font-medium">
              Verification Code
            </label>
            <input
              id="otp"
              name="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="000000"
              required
              autoFocus
              suppressHydrationWarning
              className="w-full rounded-md border bg-background px-3 py-2 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            suppressHydrationWarning
            className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {verifyPending && <Loader2 size={14} className="animate-spin" />}
            {verifyPending ? "Verifying…" : "Verify and Sign In"}
          </button>
        </form>

        <form action={requestOtp}>
          <input type="hidden" name="email" value={otpState.email} />
          <button
            type="submit"
            disabled={isPending}
            suppressHydrationWarning
            className="w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
          >
            {otpPending ? "Sending…" : "Resend Code"}
          </button>
        </form>
      </div>
    );
  }

  const externalError = error ? "Sign-In Failed. Please Try Again." : null;

  return (
    <div className="flex flex-col gap-4">
      {(externalError ?? otpState.error) && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {externalError ?? otpState.error}
        </p>
      )}

      <form action={requestOtp} className="flex flex-col gap-3">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Work Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@eagleeyedigital.io"
            required
            autoFocus
            suppressHydrationWarning
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label
            htmlFor="captchaAnswer"
            className="mb-1 block text-sm font-medium"
          >
            Enter the Code Shown Below
          </label>
          <div className="mb-2 flex items-center gap-2">
            <div
              className="overflow-hidden rounded-md border bg-background"
              // Server-generated SVG containing only shapes/text — no user input.
              dangerouslySetInnerHTML={{ __html: activeCaptcha.svg }}
            />
            <button
              type="button"
              onClick={refreshCaptcha}
              disabled={captchaLoading}
              aria-label="Get a new CAPTCHA code"
              className="rounded-md border p-2 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={captchaLoading ? "animate-spin" : ""}
              />
            </button>
          </div>
          <input type="hidden" name="captchaToken" value={activeCaptcha.token} />
          <input
            id="captchaAnswer"
            name="captchaAnswer"
            type="text"
            autoComplete="off"
            placeholder="Enter Code"
            required
            suppressHydrationWarning
            className="w-full rounded-md border bg-background px-3 py-2 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          suppressHydrationWarning
          className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {otpPending && <Loader2 size={14} className="animate-spin" />}
          {otpPending ? "Sending Code…" : "Send Verification Code"}
        </button>
      </form>
    </div>
  );
}
