import { LoginForm } from "@/features/auth/components/login-form";
import { APP_CONFIG } from "@/config/app";
import { createCaptcha } from "@/lib/captcha";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const captcha = createCaptcha();

  return (
    <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">{APP_CONFIG.name}</h1>
      <p className="mb-1 text-sm font-medium text-foreground pb-2.5">
        Sign In with Your Eagleeye Digital Account
      </p>
      {/* <p className="mb-6 text-xs text-muted-foreground">
        Enter Your @eagleeyedigital.io Email to Receive a Sign-In Code
      </p> */}
      <LoginForm error={error} captcha={captcha} />
    </div>
  );
}
