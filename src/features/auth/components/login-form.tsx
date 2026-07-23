"use client";

import { useActionState } from "react";
import {
  requestOtpAction,
  verifyOtpAction,
  type RequestOtpState,
} from "@/features/auth/actions/login";

const INITIAL_STATE: RequestOtpState = { step: "email" };

export function LoginForm({ error }: { error?: string }) {
  const [otpState, requestOtp, otpPending] = useActionState(
    requestOtpAction,
    INITIAL_STATE,
  );
  const [verifyError, verifyOtp, verifyPending] = useActionState(
    verifyOtpAction,
    undefined,
  );

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
          <p className="rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
            A New Code Was Sent.
          </p>
        )}

        {otpState.devOtp && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
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
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
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
        <button
          type="submit"
          disabled={isPending}
          suppressHydrationWarning
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {otpPending ? "Sending Code…" : "Send Verification Code"}
        </button>
      </form>
    </div>
  );
}
