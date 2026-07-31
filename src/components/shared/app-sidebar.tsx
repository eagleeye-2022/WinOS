"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  LayoutGrid,
  User,
  BarChart2,
  FileText,
  AlertCircle,
  Users2,
  HeartHandshake,
  Quote,
  Archive,
  Settings,
  UserCheck,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";

// ── Daily quotes ─────────────────────────────────────────────────────────────

const DSM_QUOTES = [
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Great things in business are never done by one person. They're done by a team of people.", author: "Steve Jobs" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Alone we can do so little; together we can do so much.", author: "Helen Keller" },
];

function getDayQuote() {
  return DSM_QUOTES[new Date().getDay() % DSM_QUOTES.length];
}

// ── Active route helper ───────────────────────────────────────────────────────

function isSubItemActive(pathname: string, href: string, label: string): boolean {
  if (label === "All DSM") {
    return pathname.startsWith("/dsm/all") || pathname.startsWith("/dsm/member");
  }
  if (label === "My DSM") {
    return pathname === ROUTES.dsmMy;
  }
  if (label === "Daily DSM" || label === "DSM") {
    return pathname === ROUTES.dsm || pathname === "/dashboard";
  }
  if (label === "DSR Management" || label === "All DSR") {
    return pathname.startsWith(ROUTES.dsrManage) || pathname.startsWith("/dsr/member");
  }
  if (label === "My DSR" || label === "DSR") {
    return pathname === ROUTES.dsr || pathname === ROUTES.dsrMy;
  }
  if (label === "iNotes" || label === "i-Notes" || label === "My Notes") {
    return pathname.startsWith("/notes");
  }
  // if (label === "Calendar") {
  //   return pathname.startsWith(ROUTES.calendar);
  // }
  if (label === "My Blockers") {
    return pathname.startsWith(ROUTES.blockers);
  }
  if (label === "Support Needed") {
    return pathname.startsWith(ROUTES.support);
  }
  if (label === "Needs My Help" || label === "Need My Help") {
    return pathname.startsWith(ROUTES.needsHelp);
  }
  if (label === "RTD Documents") {
    return pathname === "/people";
  }
  if (label === "ICA Agreements") {
    return pathname.startsWith("/people/ica");
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
  const quote = getDayQuote();

  const isManager = userRole === "MANAGER";
  const iNotesHref = userId ? `/notes/member/${userId}` : ROUTES.notes;

  const [activeModule, setActiveModule] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mod = params.get("module");
    setTimeout(() => {
      setActiveModule(mod);
    }, 0);
  }, [pathname]);

  // Determine active module title based on path
  let activeModuleTitle = "Standup";
  if (pathname.startsWith("/people") || activeModule === "people") {
    activeModuleTitle = "People";
  } else if (pathname.startsWith("/projects") || activeModule === "projects") {
    activeModuleTitle = "Projects";
  } else if (pathname.startsWith("/sales") || activeModule === "sales") {
    activeModuleTitle = "Sales";
  }

  // Dynamic items based on active module & user role
  let navItems: Array<{ label: string; href: string; icon: React.ElementType }> = [];

  if (activeModuleTitle === "People") {
    navItems = [
      { label: "RTD Documents", href: "/people", icon: FileText },
      { label: "ICA Agreements", href: "/people/ica", icon: UserCheck },
      { label: "iNotes", href: `${iNotesHref}?module=people`, icon: ClipboardList },
      { label: "Calendar", href: ROUTES.calendar, icon: Calendar },
    ];
  } else if (activeModuleTitle === "Projects") {
    navItems = [
      { label: "Projects Dashboard", href: "/projects", icon: LayoutDashboard },
      { label: "Calendar", href: ROUTES.calendar, icon: Calendar },
    ];
  } else if (activeModuleTitle === "Sales") {
    navItems = [
      { label: "Sales Hub", href: "/sales", icon: BarChart2 },
      { label: "Calendar", href: ROUTES.calendar, icon: Calendar },
    ];
  } else {
    // Standup Module
    navItems = isManager
      ? [
        { label: "Dashboard", href: ROUTES.dashboard, icon: LayoutDashboard },
        { label: "All DSM", href: ROUTES.dsmAll, icon: LayoutGrid },
        { label: "My DSM", href: ROUTES.dsmMy, icon: User },
        { label: "All DSR", href: ROUTES.dsrManage, icon: BarChart2 },
        { label: "My DSR", href: ROUTES.dsrMy, icon: ClipboardList },
        { label: "iNotes", href: iNotesHref, icon: FileText },
        // { label: "Calendar", href: ROUTES.calendar, icon: Calendar },
        { label: "My Blockers", href: ROUTES.blockers, icon: AlertCircle },
        { label: "Support Needed", href: ROUTES.support, icon: Users2 },
        // { label: "Need My Help", href: ROUTES.needsHelp, icon: HeartHandshake },
      ]
      : [
        { label: "DSM", href: ROUTES.dsm, icon: ClipboardList },
        { label: "DSR", href: ROUTES.dsr, icon: BarChart2 },
        { label: "iNotes", href: iNotesHref, icon: FileText },
        // { label: "Calendar", href: ROUTES.calendar, icon: Calendar },
        { label: "My Blockers", href: ROUTES.blockers, icon: AlertCircle },

        { label: "Support Needed", href: ROUTES.support, icon: Users2 },
        { label: "Need My Help", href: ROUTES.needsHelp, icon: HeartHandshake },
      ];
  }

  return (
    <aside className="flex justify-between w-56 shrink-0 flex-col border-r bg-card select-none h-full overflow-y-auto">
      <div>
        {/* Top Header matching exact screenshot design */}
        <div className="px-5 pt-6 pb-4">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {activeModuleTitle}
          </h2>
          <p className="text-sm font-medium text-muted-foreground/80">
            Workspace
          </p>
        </div>

        {/* Navigation links */}
        <nav className="flex flex-col gap-1.5 px-3 py-2 text-sm">
          {navItems.map((item) => {
            const active = isSubItemActive(pathname, item.href, item.label);
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-w-0",
                  active
                    ? "bg-primary/10 text-primary font-semibold shadow-2xs border-l-4 border-primary"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                <Icon size={18} strokeWidth={2} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div>
        {/* Quote Card */}
        <div className="mx-3 mb-3 rounded-xl border-l-2 border-primary/40 bg-muted/30 p-3">
          <Quote size={12} className="mb-1 text-primary/60" />
          <p className="text-[13px] leading-relaxed text-muted-foreground italic">&quot;{quote.text}&quot;</p>
          <p className="mt-1 text-[12px] font-medium text-muted-foreground/70">— {quote.author}</p>
        </div>

        {/* Footer / Secondary navigation */}
        <div className="border-t p-2 flex gap-1">
          {[
            { label: "Archive", icon: Archive },
            { label: "Settings", icon: Settings },
          ].map(({ label, icon: Icon }) => (
            <span
              key={label}
              title="Coming soon"
              className="flex-1 flex cursor-not-allowed items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground/40 select-none hover:bg-accent/30"
            >
              <Icon size={14} strokeWidth={1.75} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}
