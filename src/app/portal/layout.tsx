import Image from "next/image";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { APP_CONFIG } from "@/config/app";
import { logoutAction } from "@/features/auth/actions/logout";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { SessionGuard } from "@/components/shared/session-guard";

export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session || !session.user || !(session.user as { id?: string }).id) {
    redirect(ROUTES.clientLogin);
  }

  const profileRole = (session.user as { profileRole?: string })?.profileRole;
  if (profileRole !== "CLIENT") {
    redirect(ROUTES.home);
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <SessionGuard />
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-6">
        <div className="flex items-center gap-2">
          <Image
            src="/winos-logo.png"
            alt={APP_CONFIG.name}
            width={140}
            height={48}
            unoptimized
            className="h-8 w-auto object-contain dark:hidden"
            priority
          />
          <Image
            src="/winos-logo-dark.png"
            alt={APP_CONFIG.name}
            width={140}
            height={48}
            unoptimized
            className="h-8 w-auto object-contain hidden dark:block"
            priority
          />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              title="Sign out"
              className="h-8 w-8 rounded-full text-muted-foreground"
            >
              <LogOut size={16} />
            </Button>
          </form>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
    </div>
  );
}
