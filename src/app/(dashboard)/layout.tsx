import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HelpCircle, LogOut } from "lucide-react";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { AppSidebar } from "@/components/shared/app-sidebar";
import { ClockChip } from "@/components/shared/clock-chip";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { logoutAction } from "@/features/auth/actions/logout";
import {
  getUnreadCount,
  getNotifications,
} from "@/features/notifications/queries";
import { ModuleSwitcher } from "@/components/shared/module-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { RouteDarkScope } from "@/components/shared/route-dark-scope";
import { SessionGuard } from "@/components/shared/session-guard";

// ── WinOS brand mark ─────────────────────────────────────────────────────────

function WinOSBrand() {
  return (
    <>
      <Image
        src="/winos-logo.png"
        alt="WinOS by Eagle Eye Digital"
        width={900}
        height={170}
        unoptimized
        className="logo-light h-40 w-auto object-contain shrink-0 pt-2.5 dark:hidden"
        priority
      />
      <Image
        src="/winos-logo-dark.png"
        alt="WinOS by Eagle Eye Digital"
        width={900}
        height={170}
        unoptimized
        className="logo-dark h-40 w-auto object-contain shrink-0 pt-2.5 hidden dark:block"
        priority
      />
    </>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session || !session.user || !(session.user as { id?: string }).id) {
    redirect(ROUTES.login);
  }

  const userRole = (session.user as { role?: string })?.role ?? "TEAM_MEMBER";
  const userName = session.user?.name ?? session.user?.email ?? "";
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const [unreadCount, recentNotifications] = await Promise.all([
    getUnreadCount(),
    getNotifications(20),
  ]);

  return (
    <div className="dsm-scope flex h-screen w-screen flex-col overflow-hidden">
      <SessionGuard />
      {/* ── Full-width top bar ──────────────────────────────────────────────── */}
      <RouteDarkScope match="/dsm">
        <header className="relative flex h-14 shrink-0 items-center border-b bg-card z-50 mb-2">
          {/* Brand — same visual width as the sidebar */}
          <div className="flex h-full w-56 shrink-0 items-center border-r px-4">
            <WinOSBrand />
          </div>

          {/* Clock & Switcher */}
          <div className="flex items-center gap-3 px-4 shrink-0">
            <ClockChip />
            <ModuleSwitcher />
          </div>

          {/* Spacer — keeps right icons pinned while leaving room for future content */}
          <div className="flex-1" />

          {/* Right icons */}
          <div className="flex items-center gap-2 px-4">
            <NotificationBell
              initialUnread={unreadCount}
              initialNotifications={recentNotifications}
            />
            <ThemeToggle />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Help"
              title="Help"
              className="h-8 w-8 rounded-full text-muted-foreground"
            >
              <HelpCircle size={16} />
            </Button>
            <Link
              href={`/settings/users/member/${session.user.id}/edit`}
              title={`Profile: ${userName}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {initials || "U"}
            </Link>
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
      </RouteDarkScope>

      {/* ── Sidebar + content row ───────────────────────────────────────────── */}
      <div className="flex flex-1 justify-start w-full min-h-0">
        <RouteDarkScope match="/dsm">
          <div className="h-full w-56 shrink-0">
            <AppSidebar userRole={userRole} userId={session?.user?.id} />
          </div>
        </RouteDarkScope>

        <main className="flex-1 min-w-0 h-full overflow-hidden">{children}</main>

      </div>

    </div>
  );
}
