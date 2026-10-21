"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Home,
  ClipboardList,
  LayoutGrid,
  User,
  BarChart2,
  FileText,
  AlertCircle,
  Users2,
  HeartHandshake,
  Archive,
  Settings,
  UserCheck,
  Calendar,
  ShieldCheck,
  FolderKanban,
  Share2,
  CheckSquare,
  Clock,
  AlarmClock,
  ClockFading,
  Timer,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { SupportNeededIcon } from "@/components/icons/support-needed-icon";
import { getNavModule, resolveNavModule } from "@/lib/navigation/modules";
import { useNavigationStore } from "@/stores/navigation-store";
import { shortProjectName } from "@/features/projects/utils/project-name";

// ── Active route helper ───────────────────────────────────────────────────────

function isSubItemActive(pathname: string, href: string, label: string): boolean {
  if (label === "Home" || label === "Dashboard") {
    return pathname === ROUTES.dashboard;
  }
  if (label === "All DSM") {
    return pathname.startsWith("/dsm/all") || pathname.startsWith("/dsm/member");
  }
  if (label === "My DSM") {
    return pathname === ROUTES.dsmMy;
  }
  if (label === "Daily DSM" || label === "DSM") {
    return pathname === ROUTES.dsm || pathname === "/dashboard";
  }
  if (label === "All Reporting") {
    return pathname.startsWith(ROUTES.dsrManage) || pathname.startsWith("/report/member");
  }
  if (label === "My Reporting" || label === "Reporting") {
    return pathname === ROUTES.dsr || pathname === ROUTES.dsrMy;
  }
  if (label === "iNotes" || label === "i-Notes" || label === "My Notes") {
    return pathname.startsWith("/notes");
  }
  if (label === "Zoho Calendar" || label === "Calendar" || label === "Collaboration") {
    return pathname.startsWith(ROUTES.zohoCalendar) || pathname.startsWith(ROUTES.calendar);
  }
  if (label === "My Blockers" || label === "Blockers (Dependencies)") {
    return pathname.startsWith(ROUTES.blockers);
  }
  if (label === "Support Needed" || label === "Support Needed (Meeting)") {
    return pathname.startsWith(ROUTES.support);
  }
  if (label === "Needs My Help" || label === "Need My Help") {
    return pathname.startsWith(ROUTES.needsHelp);
  }
  if (label === "RTD Documents") {
    return pathname === "/people";
  }
  if (label === "My Leaves" || label === "Leave Tracker") {
    return (
      (pathname.startsWith("/pulse/leave") || pathname.startsWith("/leave")) &&
      !pathname.startsWith("/pulse/leave/team")
    );
  }
  if (label === "Team Leave") {
    return pathname.startsWith("/pulse/leave/team");
  }
  if (label === "Users" && pathname.startsWith("/settings")) {
    return pathname.startsWith(ROUTES.settingsUsers);
  }
  if (label === "Attendance" || label === "My Attendance") {
    return pathname.startsWith("/pulse/attendance");
  }
  if (label === "Team Attendance") {
    return pathname.startsWith("/pulse/team-attendance");
  }
  if (label === "Regularization") {
    return pathname.startsWith("/pulse/regularization");
  }
  if (label === "WhyFi School") {
    return pathname.startsWith("/pulse/whyfi-learning");
  }
  if (label === "Reports" && (pathname.startsWith("/pulse") || pathname.startsWith("/people"))) {
    return pathname.startsWith("/pulse/reports");
  }
  if (label === "All Projects" && pathname.startsWith("/projects")) {
    return pathname === "/projects" || pathname === "/projects/all";
  }
  if (label === "Users" && pathname.startsWith("/projects")) {
    return pathname === "/projects/users";
  }
  if (label === "My Dashboard" && pathname.startsWith("/projects")) {
    return pathname === "/projects/dashboard";
  }
  if (label === "My Tasks" && pathname.startsWith("/projects")) {
    return pathname === "/projects/my-tasks" || pathname === "/projects/tasks";
  }
  if (label === "Active Timers" && pathname.startsWith("/projects")) {
    return pathname === "/projects/active-timers";
  }
  if (label === "Effort Logs" && pathname.startsWith("/projects")) {
    return pathname === "/projects/effort-log-report";
  }
  if (label === "Projects Dashboard") {
    return pathname.startsWith("/projects");
  }
  if (label === "Sales Hub") {
    return pathname.startsWith("/sales");
  }
  return pathname === href;
}

// ── Sidebar Component ─────────────────────────────────────────────────────────

export function AppSidebar({ userRole, userId }: { userRole?: string; userId?: string }) {
  const pathname = usePathname();

  const isManager = userRole === "MANAGER";
  const iNotesHref = userId ? `/notes/member/${userId}` : ROUTES.notes;

  const searchParams = useSearchParams();
  const activeModuleId = resolveNavModule(pathname, searchParams);
  const resetModule = useNavigationStore((s) => s.resetModule);
  const [recentProjects, setRecentProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("winos:recentProjects");
        setRecentProjects(stored ? JSON.parse(stored) : []);
      } catch {
        setRecentProjects([]);
      }
    }, 0);
  }, [pathname]);

  // Determine active module title based on path (shared registry with the ModuleSwitcher)
  const activeModuleTitle =
    activeModuleId === "sales" ? "Sales" : (getNavModule(activeModuleId)?.label ?? "Standup");

  // Dynamic items based on active module & user role
  let navItems: Array<{ label: string; href: string; icon: React.ElementType; section?: string }> = [];

  if (activeModuleTitle === "Pulse") {
    navItems = isManager
      ? [
          { label: "Home", href: "/people", icon: Home },
          { label: "My Leaves", href: "/pulse/leave", icon: Calendar },
          { label: "Team Leave", href: "/pulse/leave/team", icon: Users2 },
          { label: "My Attendance", href: "/pulse/attendance", icon: Clock },
          { label: "Team Attendance", href: "/pulse/team-attendance", icon: Users2 },
          { label: "Regularization", href: "/pulse/regularization", icon: Timer },
          { label: "WhyFi School", href: "/pulse/whyfi-learning", icon: GraduationCap },
          // Effort logs of WhyFi School tasks only.
          { label: "Effort Logs", href: "/pulse/whyfi-effort-logs", icon: ClockFading },
          { label: "Reports", href: "/pulse/reports", icon: BarChart2 },
        ]
      : [
          { label: "Home", href: "/people", icon: Home },
          { label: "My Leaves", href: "/pulse/leave", icon: Calendar },
          { label: "My Attendance", href: "/pulse/attendance", icon: Clock },
          { label: "Team Attendance", href: "/pulse/team-attendance", icon: Users2 },
          { label: "Regularization", href: "/pulse/regularization", icon: Timer },
          { label: "WhyFi School", href: "/pulse/whyfi-learning", icon: GraduationCap },
          { label: "Reports", href: "/pulse/reports", icon: BarChart2 },
        ];
  } else if (activeModuleTitle === "Srijan" || activeModuleTitle === "Projects") {
    navItems = isManager
      ? [
          { label: "All Projects", href: "/projects", icon: FolderKanban },
          // { label: "My Dashboard", href: "/projects/dashboard", icon: LayoutDashboard, section: "OVERVIEW" },
          { label: "Users", href: "/projects/users", icon: Users2 },
          { label: "Collaboration", href: `${ROUTES.calendar}?module=projects`, icon: Calendar },
          { label: "My Tasks", href: "/projects/my-tasks", icon: CheckSquare, section: "OVERVIEW" },
          { label: "Active Timers", href: "/projects/active-timers", icon: AlarmClock, section: "OVERVIEW" },
          { label: "Effort Logs", href: "/projects/effort-log-report", icon: ClockFading, section: "OVERVIEW" },
        ]
      : [
          { label: "All Projects", href: "/projects", icon: FolderKanban },
          // { label: "My Dashboard", href: "/projects/dashboard", icon: LayoutDashboard, section: "OVERVIEW" },
          { label: "Collaboration", href: `${ROUTES.calendar}?module=projects`, icon: Calendar },
          { label: "My Tasks", href: "/projects/my-tasks", icon: CheckSquare, section: "OVERVIEW" },
          { label: "Active Timers", href: "/projects/active-timers", icon: AlarmClock, section: "OVERVIEW" },
          { label: "Effort Logs", href: "/projects/effort-log-report", icon: ClockFading, section: "OVERVIEW" },
        ];
  } else if (activeModuleTitle === "Sales") {
    navItems = [
      { label: "Sales Hub", href: "/sales", icon: BarChart2 },
      { label: "Calendar", href: ROUTES.calendar, icon: Calendar },
    ];
  } else if (activeModuleTitle === "User Management") {
    navItems = [
      { label: "Users", href: ROUTES.settingsUsers, icon: User },
      { label: "Profile Access", href: ROUTES.settingsProfileAccess, icon: ShieldCheck },
    ];
  } else {
    // Standup Module
    navItems = isManager
      ? [
        { label: "Home", href: ROUTES.dashboard, icon: Home },
        { label: "All DSM", href: ROUTES.dsmAll, icon: LayoutGrid },
        { label: "All Reporting", href: ROUTES.dsrManage, icon: BarChart2 },
        { label: "My DSM", href: ROUTES.dsmMy, icon: User },
        { label: "My Reporting", href: ROUTES.dsrMy, icon: ClipboardList },
        { label: "iNotes", href: iNotesHref, icon: FileText },
        { label: "Calendar", href: ROUTES.calendar, icon: Calendar },
        { label: "Blockers ", href: ROUTES.blockers, icon: AlertCircle },
        { label: "Support Needed ", href: ROUTES.support, icon: SupportNeededIcon },
        // The team's effort logs without leaving Standup (same report as Srijan → Effort Logs).
        { label: "Effort Log", href: "/dsm/effort-logs", icon: ClockFading },
      ]
      : [
        { label: "DSM", href: ROUTES.dsm, icon: ClipboardList },
        { label: "Reporting", href: ROUTES.dsr, icon: BarChart2 },
        { label: "iNotes", href: iNotesHref, icon: FileText },
        { label: "Calendar", href: ROUTES.calendar, icon: Calendar },
        { label: "Blockers", href: ROUTES.blockers, icon: AlertCircle },

        { label: "Support Needed", href: ROUTES.support, icon: SupportNeededIcon },
        { label: "Need My Help", href: ROUTES.needsHelp, icon: HeartHandshake },
      ];
  }

  return (
    // The sidebar itself doesn't scroll: the top part takes the space left above the footer,
    // and inside it only the Recent Projects list scrolls (the menu scrolls only if it alone overflows).
    <aside className="flex justify-between w-56 shrink-0 flex-col border-r bg-card select-none h-full overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* Top Header matching exact screenshot design */}
        <div className="shrink-0 px-5 pt-6 pb-4">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {activeModuleTitle}
          </h2>
          <p className="text-sm font-medium text-muted-foreground/80">
            Workspace
          </p>
        </div>

        {/* Navigation links */}
        <nav className="flex shrink-0 flex-col gap-1.5 px-3 py-2 text-sm">
          {(() => {
            const firstSectionIdx = navItems.findIndex((i) => Boolean(i.section));
            return navItems.map((item, idx) => {
            const active = isSubItemActive(pathname, item.href, item.label);
            const Icon = item.icon;
            const prevSection = idx > 0 ? navItems[idx - 1].section : undefined;
            const showSectionHeader = Boolean(item.section) && item.section !== prevSection;

            return (
              <div key={item.label} className="contents">
                {/* First OVERVIEW header commented out per request */}
                {showSectionHeader && idx !== firstSectionIdx && (
                  <p className="px-3 pt-3 pb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                    {item.section}
                  </p>
                )}
                <Link
                  href={item.href}
                  // The first item is the module's root/"Home": clicking it is an explicit
                  // request for the default view, so forget the module's remembered state.
                  onClick={idx === 0 ? () => resetModule(activeModuleId) : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-w-0",
                    active
                      ? "bg-primary/10 text-primary font-semibold shadow-2xs border-l-4 border-primary"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  <Icon size={item.label.startsWith("Support Needed") ? 20 : 18} strokeWidth={2} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </div>
            );
            });
          })()}
        </nav>

        {/* Recent Projects shortcuts (Srijan module only) */}
        {(activeModuleTitle === "Srijan" || activeModuleTitle === "Projects") && recentProjects.length > 0 && (
          <div className="flex min-h-28 flex-1 flex-col px-3 py-2">
            <p className="shrink-0 px-3 pb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
              Recent Projects
            </p>
            {/* Every remembered project (up to RECENT_PROJECTS_LIMIT); only this list scrolls. */}
            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto dsm-columns-scrollbar">
              {recentProjects.map((rp) => (
                <Link
                  key={rp.id}
                  href={`/projects/${rp.id}`}
                  title={rp.name}
                  className="flex shrink-0 items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium min-w-0 text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-all"
                >
                  <FolderKanban size={16} strokeWidth={2} className="shrink-0" />
                  <span className="truncate">{shortProjectName(rp.name)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0">
        {/* Footer / Secondary navigation */}
        <div className="border-t p-2 flex gap-1">
          <span
            title="Coming soon"
            className="flex-1 flex cursor-not-allowed items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground/40 select-none hover:bg-accent/30"
          >
            <Archive size={14} strokeWidth={1.75} />
            Archive
          </span>
          {isManager && (
            <Link
              href={ROUTES.settingsUsers}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs select-none transition-colors",
                pathname.startsWith("/settings")
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
              )}
            >
              <Settings size={14} strokeWidth={1.75} />
              Settings
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
