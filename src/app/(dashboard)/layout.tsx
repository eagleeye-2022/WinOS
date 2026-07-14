import Image from "next/image";
import { redirect } from "next/navigation";
import { HelpCircle, LogOut, Search } from "lucide-react";
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
    <div className="flex min-h-screen flex-col">
      {/* ── Full-width top bar ──────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center border-b bg-card">
        {/* Brand — same visual width as the sidebar */}
        <div className="flex h-full w-50 shrink-0 items-center border-r px-4">
          <WinOSBrand />
        </div>

        {/* Clock */}
        <div className="px-4">
          <ClockChip />
        </div>

        {/* Search — centered in remaining space */}
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="flex w-full max-w-sm items-center gap-2 rounded-full border bg-background px-3 py-1.5">
            <Search size={13} className="shrink-0 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search WinOS..."
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-2 px-4">
          <NotificationBell
            initialUnread={unreadCount}
            initialNotifications={recentNotifications}
          />
          <button
            type="button"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent"
          >
            <HelpCircle size={16} />
          </button>
          <span
            title={userName}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
          >
            {initials || "U"}
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign out"
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent"
            >
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </header>

      {/* ── Sidebar + content row ───────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar userRole={userRole} userId={session.user.id} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
