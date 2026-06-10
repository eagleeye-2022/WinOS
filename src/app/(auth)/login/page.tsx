import { LoginForm } from "@/features/auth/components/login-form";
import { APP_CONFIG } from "@/config/app";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">{APP_CONFIG.name}</h1>
      <p className="mb-1 text-sm font-medium text-foreground">
        Sign in with your Eagle Eye Digital account
      </p>
      <p className="mb-6 text-xs text-muted-foreground">
        Enter your @eagleeyedigital.io email to receive a sign-in code
      </p>
      <LoginForm error={error} />
    </div>
  );
}
