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

  // Manual refresh (via the button) overrides the action's CAPTCHA
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

  return (
    <div className="flex flex-col gap-4">
      {otpState.step === "otp" && otpState.email ? (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            Enter the 6-Digit Code Sent to{" "}
            <strong className="text-foreground">{otpState.email}</strong>.
          </p>

          {(otpState.resent ? otpState.error : verifyError ?? otpState.error) && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {otpState.resent ? otpState.error : verifyError ?? otpState.error}
            </p>
          )}

          {otpState.resent && !verifyError && !otpState.error && (
            <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs font-medium text-success">
              A New Code Was Sent.
            </p>
          )}

          {otpState.devOtp && (
            <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-medium text-warning font-mono">
              Dev — OTP: <strong>{otpState.devOtp}</strong>
            </p>
          )}

          <form action={verifyOtp} className="flex flex-col gap-3">
            <input type="hidden" name="email" value={otpState.email} />
            <div>
              <label htmlFor="otp" className="mb-1 block text-xs font-semibold">
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
                className="w-full rounded-md border bg-background px-3 py-2 text-xs tracking-widest focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
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
              className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50 cursor-pointer"
            >
              {otpPending ? "Sending…" : "Resend Code"}
            </button>
          </form>
        </div>
      ) : (
        <form action={requestOtp} className="flex flex-col gap-3">
          {(error || otpState.error) && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {error || otpState.error}
            </p>
          )}

          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-semibold">
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
              className="w-full rounded-md border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label
              htmlFor="captchaAnswer"
              className="mb-1 block text-xs font-semibold"
            >
              Enter the Code Shown Below
            </label>
            <div className="mb-2 flex items-center gap-2">
              <div
                className="overflow-hidden rounded-md border bg-background"
                dangerouslySetInnerHTML={{ __html: activeCaptcha.svg }}
              />
              <button
                type="button"
                onClick={refreshCaptcha}
                disabled={captchaLoading}
                aria-label="Get a new CAPTCHA code"
                className="rounded-md border p-2 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50 cursor-pointer"
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
              className="w-full rounded-md border bg-background px-3 py-2 text-xs tracking-widest focus:outline-none focus:ring-2 focus:ring-ring font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
          >
            {otpPending && <Loader2 size={14} className="animate-spin" />}
            {otpPending ? "Sending Code…" : "Send Verification Code"}
          </button>
        </form>
      )}
    </div>
  );
}
