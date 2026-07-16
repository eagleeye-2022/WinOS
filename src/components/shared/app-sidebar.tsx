"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, NotepadText, ClipboardList, BarChart2,
  AlertCircle, Users2, Clock, Archive, Settings, Quote,
  LayoutGrid, User, HeartHandshake, FileText, Activity, Brain
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";

// ── Generic app nav (Dashboard / Notes / DSM) ─────────────────────────────────

const appNavItems = [
  { label: "Dashboard", href: ROUTES.dashboard, icon: LayoutDashboard },
  { label: "Notes", href: ROUTES.notes, icon: NotepadText },
  { label: "DSM", href: ROUTES.dsm, icon: ClipboardList },
] as const;

// ── Shared daily quotes ───────────────────────────────────────────────────────

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

// ── Manager DSM sidebar ───────────────────────────────────────────────────────

function isManagerNavActive(pathname: string, href: string): boolean {
  if (href === ROUTES.dsmAll) {
    return pathname.startsWith("/dsm/all") || pathname.startsWith("/dsm/member");
  }
  if (href === ROUTES.dsrManage) {
    return pathname.startsWith("/dsr/manage") || pathname.startsWith("/dsr/member");
  }
  return pathname.startsWith(href);
}

function ManagerDsmSidebar({ pathname }: { pathname: string }) {
  const quote = getDayQuote();

  const nav = [
    { label: "All DSM", href: ROUTES.dsmAll, icon: LayoutGrid },
    { label: "My DSM", href: ROUTES.dsmMy, icon: User },
    { label: "DSR", href: ROUTES.dsrManage, icon: BarChart2 },
    { label: "My DSR", href: ROUTES.dsrMy, icon: User },
    { label: "My Blockers", href: ROUTES.blockers, icon: AlertCircle },
    { label: "Support Needed", href: ROUTES.support, icon: Users2 },
    { label: "Needs My Help", href: ROUTES.needsHelp, icon: HeartHandshake },
  ] as const;

  return (
    <aside className="flex w-50 shrink-0 flex-col border-r bg-card">
      <div className="border-b px-4 py-4">
        <p className="text-sm font-semibold text-foreground">Standup</p>
        <p className="text-[11px] text-muted-foreground">Workspace</p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-2 pt-3">
        {nav.map(({ label, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              isManagerNavActive(pathname, href) && "bg-primary font-medium text-primary-foreground"
            )}
          >
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mx-3 mb-4 rounded-md border-l-2 border-primary/40 bg-muted/40 px-3 py-3">
        <Quote size={12} className="mb-1 text-primary/50" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">&quot;{quote.text}&quot;</p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">— {quote.author}</p>
      </div>

      <div className="border-t p-2">
        {[
          { label: "Archive", icon: Archive },
          { label: "Settings", icon: Settings },
        ].map(({ label, icon: Icon }) => (
          <span
            key={label}
            title="Coming soon"
            className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground/40 select-none"
          >
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </span>
        ))}
      </div>
    </aside>
  );
}

// ── Team-member DSM sidebar ───────────────────────────────────────────────────

function DsmSidebar({ pathname, userId }: { pathname: string; userId?: string }) {
  const quote = getDayQuote();

  const dsmNav = [
    { label: "DSM", href: ROUTES.dsm, icon: ClipboardList },
    { label: "DSR", href: ROUTES.dsr, icon: BarChart2 },
    { label: "My Blockers", href: ROUTES.blockers, icon: AlertCircle },
    ...(userId ? [{ label: "i-Notes", href: `/notes/member/${userId}`, icon: NotepadText }] : []),
    { label: "Support Needed", href: ROUTES.support, icon: Users2 },
    { label: "Needs My Help", href: ROUTES.needsHelp, icon: HeartHandshake },
  ];

  return (
    <aside className="flex w-50 shrink-0 flex-col border-r bg-card">
      <div className="border-b px-4 py-4">
        <p className="text-sm font-semibold text-foreground">Standup</p>
        <p className="text-[11px] text-muted-foreground">Workspace</p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-2 pt-3">
        {dsmNav.map(({ label, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              pathname === href && "bg-primary font-medium text-primary-foreground"
            )}
          >
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </Link>
        ))}

        <div className="mt-4 px-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Quick Links
          </p>
          <Link
            href={ROUTES.dsm}
            className="flex items-center gap-2 rounded-md py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Clock size={12} />
            Yesterday&apos;s DSM
          </Link>
        </div>
      </nav>

      <div className="mx-3 mb-4 rounded-md border-l-2 border-primary/40 bg-muted/40 px-3 py-3">
        <Quote size={12} className="mb-1 text-primary/50" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">&quot;{quote.text}&quot;</p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">— {quote.author}</p>
      </div>

      <div className="border-t p-2">
        {[
          { label: "Archive", icon: Archive },
          { label: "Settings", icon: Settings },
        ].map(({ label, icon: Icon }) => (
          <span
            key={label}
            title="Coming soon"
            className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground/40 select-none"
          >
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </span>
        ))}
      </div>
    </aside>
  );
}

// ── Generic sidebar ───────────────────────────────────────────────────────────

function GenericSidebar({ pathname, userId }: { pathname: string; userId?: string }) {
  return (
    <aside className="flex w-50 shrink-0 flex-col border-r bg-card">
      <nav className="flex flex-1 flex-col gap-0.5 p-2 pt-3">
        {appNavItems.map(({ label, href, icon: Icon }) => {
          const targetHref = label === "Notes" && userId ? `/notes/member/${userId}` : href;
          return (
            <Link
              key={href}
              href={targetHref}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                pathname === targetHref && "bg-primary/10 font-medium text-primary"
              )}
            >
              <Icon size={15} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

// ── People workspace sidebar ──────────────────────────────────────────────────

function PeopleSidebar({ pathname, userId }: { pathname: string; userId?: string }) {
  const quote = {
    text: "Great things in business are never done by one person. They're done by a team of people.",
    author: "Steve Jobs"
  };

  const nav = [
    { label: "RTD", href: "/people", icon: FileText },
    { label: "ICA", href: "/people/ica", icon: Brain },
    ...(userId ? [{ label: "My Notes", href: `/notes/member/${userId}`, icon: NotepadText }] : []),
    { label: "My activities", href: "/people/activities", icon: Activity },
    { label: "Support Needed", href: ROUTES.support, icon: Users2 },
    { label: "Needs My Help", href: ROUTES.needsHelp, icon: HeartHandshake },
  ];

  return (
    <aside className="flex w-50 shrink-0 flex-col border-r bg-card animate-in fade-in duration-150">
      <div className="border-b px-4 py-4">
        <p className="text-sm font-semibold text-foreground">People</p>
        <p className="text-[11px] text-muted-foreground">Workspace</p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-2 pt-3">
        {nav.map(({ label, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              pathname === href && "bg-primary font-medium text-primary-foreground"
            )}
          >
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </Link>
        ))}

        <div className="mt-4 px-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Quick Links
          </p>
          <Link
            href={ROUTES.dsm}
            className="flex items-center gap-2 rounded-md py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Clock size={12} />
            Yesterday&apos;s DSM
          </Link>
        </div>
      </nav>

      <div className="mx-3 mb-4 rounded-md border-l-2 border-primary/40 bg-muted/40 px-3 py-3">
        <Quote size={12} className="mb-1 text-primary/50" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">&quot;{quote.text}&quot;</p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">— {quote.author}</p>
      </div>

      <div className="border-t p-2">
        {[
          { label: "Archive", icon: Archive },
          { label: "Settings", icon: Settings },
        ].map(({ label, icon: Icon }) => (
          <span
            key={label}
            title="Coming soon"
            className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground/40 select-none"
          >
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </span>
        ))}
      </div>
    </aside>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export function AppSidebar({ userRole, userId }: { userRole?: string; userId?: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/people")) {
    return <PeopleSidebar pathname={pathname} userId={userId} />;
  }
  const isWorkspace = pathname.startsWith("/dsm") || pathname.startsWith("/dsr") || pathname.startsWith("/blockers") || pathname.startsWith("/support") || pathname.startsWith("/needs-help");
  if (!isWorkspace) return <GenericSidebar pathname={pathname} userId={userId} />;
  if (userRole === "MANAGER") return <ManagerDsmSidebar pathname={pathname} />;
  return <DsmSidebar pathname={pathname} userId={userId} />;
}
