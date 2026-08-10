import Image from "next/image";
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

// ── WinOS brand mark ─────────────────────────────────────────────────────────

function WinOSBrand() {
  return (
    <Image
      src="/winos-logo.png.png"
      alt="WinOS by Eagle Eye Digital"
      width={110}
      height={38}
      className="object-contain"
      priority
    />
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) redirect(ROUTES.login);

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
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      {/* ── Full-width top bar ──────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center border-b bg-card z-10 mb-2">
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
          {/* <ThemeToggle /> */}
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
          <span
            title={userName}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
          >
            {initials || "U"}
          </span>
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

      {/* ── Sidebar + content row ───────────────────────────────────────────── */}
      <div className="flex flex-1 justify-start w-full min-h-0">
        <div className="h-full w-56 shrink-0">
          <AppSidebar userRole={userRole} userId={session?.user?.id} />
        </div>

        <main className="w-full min-h-0 overflow-y-auto">{children}</main>

      </div>

    </div>
  );
}
