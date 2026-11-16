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
import { NavigationStateTracker } from "@/components/shared/navigation-state-tracker";
import { TableColumnResizer } from "@/components/shared/table-column-resizer";
import { getMyModuleAccessAction } from "@/features/users/actions/permission-actions";
import { PendingTimerLogRecovery } from "@/features/projects/components/pending-timer-log-recovery";
import { ChecklistGateHost } from "@/features/sop-checklists/components/checklist-gate";
import { UserAvatar, UserAvatarProvider } from "@/components/shared/user-avatar";
import { canManageAttendance } from "@/features/attendance/utils";
import { db } from "@/lib/db";
import { MobileNavDrawer, MobileNavProvider, MobileNavToggle } from "@/components/shared/mobile-nav";

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
  // Guaranteed by the redirect above (TS can't narrow through the cast).
  const userId = session.user.id as string;

  const profileRole = (session.user as { profileRole?: string })?.profileRole;
  if (profileRole === "CLIENT") {
    redirect(ROUTES.clientPortal);
  }

  const userRole = (session.user as { role?: string })?.role ?? "TEAM_MEMBER";
  const userName = session.user?.name ?? session.user?.email ?? "";
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isManager = userRole === "MANAGER";

  const [unreadCount, recentNotifications, myModuleAccess, avatarUsers] = await Promise.all([
    getUnreadCount(),
    getNotifications(20),
    getMyModuleAccessAction(),
    // Only users with a photo — everyone else falls back to initials.
    db.user.findMany({
      where: { image: { not: null } },
      select: { id: true, name: true, email: true, image: true },
    }),
  ]);

  return (
    <UserAvatarProvider users={avatarUsers}>
    <MobileNavProvider>
    {/* 100dvh, not 100vh: on phones the browser's address bar would otherwise hide the bottom. */}
    <div className="flex h-[100dvh] w-screen flex-col overflow-hidden">
      <SessionGuard />
      {/* Per-module "where you left off": last URL + scroll, restored on module re-entry. */}
      <NavigationStateTracker />
      {/* Excel-style drag-to-resize on every table header edge. */}
      <TableColumnResizer />
      {/* Re-opens the "Timer stopped" log modal if a stopped timer's log was never saved. */}
      <PendingTimerLogRecovery userId={userId} />
      {/* "Please select / complete the checklist" popup when closing a task is refused. */}
      <ChecklistGateHost />
      {/* ── Full-width top bar ──────────────────────────────────────────────── */}
      <RouteDarkScope match="/dsm">
        <header className="relative flex h-14 shrink-0 items-center border-b bg-card z-50 mb-2">
          {/* Phones: ☰ opens the sidebar drawer */}
          <MobileNavToggle className="ml-2" />

          {/* Brand — same visual width as the sidebar (hidden on phones to make room) */}
          <div className="hidden h-full w-56 shrink-0 items-center border-r px-4 md:flex">
            <WinOSBrand />
          </div>

          {/* Clock & Switcher — on phones the switcher takes the free width and scrolls sideways */}
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto px-2 [scrollbar-width:none] md:flex-none md:shrink-0 md:overflow-visible md:px-4">
            <div className="hidden lg:block">
              <ClockChip />
            </div>
            <ModuleSwitcher access={myModuleAccess.access} isManager={isManager} />
          </div>

          {/* Spacer — keeps right icons pinned while leaving room for future content */}
          <div className="hidden flex-1 md:block" />

          {/* Right icons */}
          <div className="flex shrink-0 items-center gap-1 px-2 md:gap-2 md:px-4">
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
              className="hidden h-8 w-8 rounded-full text-muted-foreground sm:inline-flex"
            >
              <HelpCircle size={16} />
            </Button>
            <Link
              href={`/settings/users/member/${session.user.id}/edit`}
              title={`Profile: ${userName}`}
              className="rounded-full hover:opacity-90 transition-opacity"
            >
              <UserAvatar
                userId={userId}
                title=""
                className="h-8 w-8 bg-primary text-xs font-bold text-primary-foreground"
              >
                {initials || "U"}
              </UserAvatar>
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
          <MobileNavDrawer>
            <AppSidebar
              userRole={userRole}
              userId={session?.user?.id}
              canManagePulse={canManageAttendance(session?.user)}
            />
          </MobileNavDrawer>
        </RouteDarkScope>

        <main data-nav-root className="flex-1 min-w-0 h-full overflow-hidden">{children}</main>

      </div>

    </div>
    </MobileNavProvider>
    </UserAvatarProvider>
  );
}
