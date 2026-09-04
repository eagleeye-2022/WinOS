"use client";

import { useActionState, useState } from "react";
import { Loader2, Lock, Mail } from "lucide-react";
import { loginWithPasswordAction } from "@/features/auth/actions/login";

export function ClientLoginForm({
  error,
  initialEmail = "",
}: {
  error?: string;
  initialEmail?: string;
}) {
  const [emailInput, setEmailInput] = useState(initialEmail);
  const [passwordInput, setPasswordInput] = useState("");

  const [passwordError, loginWithPassword, passwordPending] = useActionState(
    loginWithPasswordAction,
    undefined,
  );

  return (
    <form action={loginWithPassword} className="flex flex-col gap-3">
      {(passwordError || error) && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
          {passwordError || error}
        </p>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block text-xs font-semibold text-foreground">
          Client Email Address
        </label>
        <div className="relative">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="you@company.com"
            required
            autoFocus
            className="w-full rounded-md border bg-background px-3 py-2 text-xs text-foreground pr-9 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Mail
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-xs font-semibold text-foreground">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Enter your password"
            required
            className="w-full rounded-md border bg-background px-3 py-2 text-xs text-foreground pr-9 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Lock
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={passwordPending}
        className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 mt-1 cursor-pointer"
      >
        {passwordPending && <Loader2 size={14} className="animate-spin" />}
        {passwordPending ? "Signing In…" : "Sign In to Client Portal"}
      </button>
    </form>
  );
}
