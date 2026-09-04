import { ClientLoginForm } from "@/features/auth/components/client-login-form";
import { APP_CONFIG } from "@/config/app";
import Image from "next/image";
import Link from "next/link";

export default async function ClientLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; accepted?: string; email?: string }>;
}) {
  const { error, accepted, email } = await searchParams;

  const isClientAccepted = accepted === "true";

  return (
    <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
      <div className="mb-4 flex items-center justify-start">
        <Image
          src="/winos-logo.png"
          alt={APP_CONFIG.name}
          width={500}
          height={170}
          unoptimized
          className="logo-light h-14 w-auto object-contain dark:hidden"
          priority
        />
        <Image
          src="/winos-logo-dark.png"
          alt={APP_CONFIG.name}
          width={500}
          height={170}
          unoptimized
          className="logo-dark h-14 w-auto object-contain hidden dark:block"
          priority
        />
      </div>

      <div className="mb-4">
        <h1 className="text-base font-bold text-foreground">
          Client Portal Sign In
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Access your assigned projects and collaboration workspace
        </p>
      </div>

      {isClientAccepted && (
        <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400 font-semibold leading-snug">
          ✓ Invitation accepted! Please sign in with your password below.
        </div>
      )}

      <ClientLoginForm
        error={error}
        initialEmail={email || ""}
      />

      <div className="mt-6 border-t pt-4 text-center">
        <p className="text-xs text-muted-foreground">
          Are you a team member or manager?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary hover:underline"
          >
            Sign in to Staff Portal →
          </Link>
        </p>
      </div>
    </div>
  );
}
