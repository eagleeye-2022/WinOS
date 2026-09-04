import { LoginForm } from "@/features/auth/components/login-form";
import { APP_CONFIG } from "@/config/app";
import { createCaptcha } from "@/lib/captcha";
import Image from "next/image";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const captcha = createCaptcha();

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

      <p className="mb-1 text-sm font-medium text-foreground pb-2.5">
        Sign In with Your Eagleeye Digital Account
      </p>

      <LoginForm error={error} captcha={captcha} />
    </div>
  );
}
