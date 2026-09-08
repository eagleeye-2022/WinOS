"use client";

import React, { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Briefcase,
  ArrowRight,
  Lock,
} from "lucide-react";
import {
  validateClientInvitationAction,
  acceptClientInvitationAction,
  ClientInvitationDetails,
} from "@/features/projects/actions/client-invitation-actions";
import { APP_CONFIG } from "@/config/app";

export default function AcceptClientInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = use(searchParams);
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<ClientInvitationDetails | null>(null);

  const [clientName, setClientName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isAccepted, setIsAccepted] = useState(false);

  useEffect(() => {
    async function loadAndValidate() {
      if (!token) {
        setErrorMsg("Invitation token is missing from the URL link.");
        setIsLoading(false);
        return;
      }

      try {
        const res = await validateClientInvitationAction(token);
        if (!res.success || !res.data) {
          setErrorMsg(res.error || "This invitation link is invalid or expired.");
        } else {
          setInvitation(res.data);
          setClientName(res.data.clientName || "");
        }
      } catch (err) {
        setErrorMsg("Failed to validate invitation token.");
      } finally {
        setIsLoading(false);
      }
    }
    loadAndValidate();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!token) return;

    if (!invitation?.isExistingUser) {
      if (!password || password.length < 6) {
        setSubmitError("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setSubmitError("Passwords do not match.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await acceptClientInvitationAction(
        token,
        password || undefined,
        clientName || undefined
      );

      if (!res.success) {
        setSubmitError(res.error || "Failed to accept invitation.");
      } else {
        setIsAccepted(true);
        setTimeout(() => {
          router.push(`/client/login?accepted=true&email=${encodeURIComponent(invitation?.email || "")}`);
        }, 2000);
      }
    } catch (err) {
      setSubmitError("An unexpected error occurred during acceptance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Header Branding */}
      <div className="mb-6 flex flex-col items-center">
        <Image
          src="/winos-logo.png"
          alt={APP_CONFIG.name}
          width={220}
          height={75}
          unoptimized
          className="h-12 w-auto object-contain dark:hidden"
          priority
        />
        <Image
          src="/winos-logo-dark.png"
          alt={APP_CONFIG.name}
          width={220}
          height={75}
          unoptimized
          className="h-12 w-auto object-contain hidden dark:block"
          priority
        />
        <span className="mt-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Client Collaboration Portal
        </span>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">
              Validating your client invitation link...
            </p>
          </div>
        ) : errorMsg ? (
          <div className="flex flex-col items-center text-center py-4 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle size={28} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                Invitation Link Invalid
              </h1>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                {errorMsg}
              </p>
            </div>
            <Link
              href="/client/login"
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Go to Client Login Screen <ArrowRight size={14} />
            </Link>
          </div>
        ) : isAccepted ? (
          <div className="flex flex-col items-center text-center py-6 space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Invitation Accepted!
              </h1>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Your client account has been activated and added to the assigned projects. Redirecting to sign in...
              </p>
            </div>
            <Loader2 size={20} className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Invitation Banner */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck size={20} />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-foreground">
                  You&apos;re Invited!
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <strong className="text-foreground">{invitation?.inviterName}</strong> has invited you to collaborate on the following project(s):
                </p>
              </div>
            </div>

            {/* Projects List */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Assigned Projects
              </span>
              <div className="rounded-lg border border-border bg-background p-3 space-y-2 max-h-36 overflow-y-auto">
                {invitation?.projects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2.5 text-xs font-semibold text-foreground"
                  >
                    <Briefcase size={14} className="text-primary shrink-0" />
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Acceptance Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Email Address
                </label>
                <input
                  type="email"
                  value={invitation?.email}
                  disabled
                  className="w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-xs text-muted-foreground cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Your Full Name
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {!invitation?.isExistingUser ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Create Password
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground pr-9 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <Lock
                        size={15}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </>
              ) : (
                <div className="p-3 rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground">
                  An existing client account is associated with this email. Click accept to grant access to the new project(s).
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 mt-2"
              >
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                {invitation?.isExistingUser
                  ? "Accept Invitation & Join Projects"
                  : "Create Account & Accept Invitation"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
