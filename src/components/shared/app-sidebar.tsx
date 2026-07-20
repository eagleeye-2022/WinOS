"use client";

import { useState } from "react";
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
  ChevronRight,
  ChevronDown,
  Share2,
  Users,
  UserCheck,
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

// ── Active route helpers ──────────────────────────────────────────────────────

function isDsmHeaderActive(pathname: string, parentHref: string): boolean {
  return pathname === parentHref;
}

function isSubItemActive(pathname: string, href: string, label: string): boolean {
  if (label === "All DSM") {
    return pathname.startsWith("/dsm/all") || pathname.startsWith("/dsm/member");
  }
  if (label === "My DSM") {
    return pathname === ROUTES.dsmMy;
  }
  if (label === "Daily DSM") {
    return pathname === ROUTES.dsm;
  }
  if (label === "DSR Management" || label === "DSR") {
    return pathname === ROUTES.dsrManage;
  }
  if (label === "I-Notes") {
    return pathname.startsWith("/notes");
  }
  if (label === "My DSR") {
    return pathname === ROUTES.dsr || pathname === ROUTES.dsrMy;
  }
  if (label === "My Blockers") {
    return pathname.startsWith(ROUTES.blockers);
  }
  if (label === "Support Needed") {
    return pathname.startsWith(ROUTES.support);
  }
  if (label === "Needs My Help") {
    return pathname.startsWith(ROUTES.needsHelp);
  }
  return pathname === href;
}

// ── Sidebar Component ─────────────────────────────────────────────────────────

export function AppSidebar({ userRole, userId }: { userRole?: string; userId?: string }) {
  const pathname = usePathname();
  const quote = getDayQuote();
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  const isManager = userRole === "MANAGER";
  const parentHref = isManager ? ROUTES.dsmAll : ROUTES.dsm;
  const iNotesHref = userId ? `/notes/member/${userId}` : ROUTES.notes;

  const dsmSubItems = isManager
    ? [
        { label: "Dashboard", href: ROUTES.dashboard, icon: LayoutDashboard },
        { label: "All DSM", href: ROUTES.dsmAll, icon: LayoutGrid },
        { label: "My DSM", href: ROUTES.dsmMy, icon: User },
        { label: "DSR Management", href: ROUTES.dsrManage, icon: BarChart2 },
        { label: "I-Notes", href: iNotesHref, icon: FileText },
        { label: "My Blockers", href: ROUTES.blockers, icon: AlertCircle },
        { label: "Support Needed", href: ROUTES.support, icon: Users2 },
        { label: "Needs My Help", href: ROUTES.needsHelp, icon: HeartHandshake },
      ]
    : [
        { label: "Daily DSM", href: ROUTES.dsm, icon: ClipboardList },
        { label: "My DSR", href: ROUTES.dsr, icon: BarChart2 },
        { label: "I-Notes", href: ROUTES.notes, icon: FileText },
        { label: "My Blockers", href: ROUTES.blockers, icon: AlertCircle },
        { label: "Support Needed", href: ROUTES.support, icon: Users2 },
        { label: "Needs My Help", href: ROUTES.needsHelp, icon: HeartHandshake },
      ];

  const isAnyDsmChildActive = dsmSubItems.some((item) =>
    isSubItemActive(pathname, item.href, item.label)
  );

  return (
    <aside className="flex justify-between w-56 shrink-0 flex-col border-r bg-card select-none sticky top-0 h-[90vh]">
      <div>
        <div className="border-b px-4 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
            Navigation
          </p>
        </div>

        <nav className="flex flex-col gap-1 p-3 text-sm">
          {/* DSM Tree section */}
          <div className="mt-2 flex flex-col">
            {/* DSM Parent Item */}
            <Link
              href={parentHref}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                isDsmHeaderActive(pathname, parentHref)
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : isAnyDsmChildActive
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <div className="flex items-center gap-2.5">
                <ClipboardList size={16} strokeWidth={1.8} />
                <span>Standups</span>
              </div>
              <ChevronRight size={14} className="rotate-90 text-muted-foreground/70" />
            </Link>

            {/* Tree branch connector lines container */}
            <div className="relative ml-5.5 my-1 pl-3.5 border-l-2 border-border/60 flex flex-col gap-0.5">
              {dsmSubItems.map((item, index) => {
                const isLast = index === dsmSubItems.length - 1;
                const active = isSubItemActive(pathname, item.href, item.label);
                const Icon = item.icon;
                const isINotes = item.label === "I-Notes";
                const memberNotesHref = userId ? `/notes/member/${userId}` : "/notes/member";

                if (isINotes) {
                  return (
                    <div key={item.label} className="relative flex flex-col">
                      <div className="relative flex items-center justify-between py-0.5 group/item">
                        <span
                          className={cn(
                            "absolute -left-[15px] top-4 w-3 h-[2px] bg-border/60 -translate-y-1/2",
                            active && "bg-primary"
                          )}
                        />
                        {isLast && !isNotesExpanded && (
                          <span className="absolute -left-[16px] top-4 bottom-0 w-[4px] bg-card" />
                        )}

                        <div className="flex flex-1 items-center justify-between min-w-0 rounded-md">
                          <Link
                            href={item.href}
                            className={cn(
                              "flex flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors min-w-0",
                              active
                                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            <Icon size={14} strokeWidth={1.75} className="shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </Link>

                          {/* Toggle chevron ^ button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsNotesExpanded((prev) => !prev);
                            }}
                            className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0 mr-1"
                            title={isNotesExpanded ? "Hide sub-links (^)" : "Show sub-links (^)"}
                          >
                            <ChevronDown
                              size={13}
                              className={cn(
                                "transition-transform duration-200",
                                isNotesExpanded ? "rotate-180" : "rotate-0"
                              )}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Expandable 3 Sub-Navigation Items with Icon + Text */}
                      {isNotesExpanded && (
                        <div className="relative ml-4 pl-3 border-l-2 border-border/40 flex flex-col gap-1 my-1">
                          {[
                            {
                              label: "Shared By Me",
                              href: "/notes/shared-by-me",
                              icon: Users,
                              iconColor: "text-emerald-500",
                            },
                            {
                              label: "Shared With Me",
                              href: "/notes/shared-with-me",
                              icon: Share2,
                              iconColor: "text-primary",
                            },
                            {
                              label: "Member Notes",
                              href: memberNotesHref,
                              icon: UserCheck,
                              iconColor: "text-amber-500",
                            },
                          ].map((sub, subIdx, arr) => {
                            const isSubLast = subIdx === arr.length - 1;
                            const isSubActive = pathname === sub.href;
                            const SubIcon = sub.icon;

                            return (
                              <div key={sub.label} className="relative flex items-center py-0.5">
                                <span
                                  className={cn(
                                    "absolute -left-[13px] top-1/2 w-2.5 h-[2px] bg-border/40 -translate-y-1/2",
                                    isSubActive && "bg-primary"
                                  )}
                                />
                                {isSubLast && isLast && (
                                  <span className="absolute -left-[14px] top-1/2 bottom-0 w-[4px] bg-card" />
                                )}

                                <Link
                                  href={sub.href}
                                  className={cn(
                                    "flex flex-1 items-center gap-2 rounded-md px-2 py-1 text-[11px] font-medium transition-colors truncate",
                                    isSubActive
                                      ? "bg-accent text-foreground font-semibold"
                                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                  )}
                                >
                                  <SubIcon size={13} className={cn("shrink-0", sub.iconColor)} />
                                  <span className="truncate">{sub.label}</span>
                                </Link>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={item.label} className="relative flex items-center py-0.5 group/item">
                    <span
                      className={cn(
                        "absolute -left-[15px] top-1/2 w-3 h-[2px] bg-border/60 -translate-y-1/2",
                        active && "bg-primary"
                      )}
                    />
                    {isLast && (
                      <span className="absolute -left-[16px] top-1/2 bottom-0 w-[4px] bg-card" />
                    )}

                    <Link
                      href={item.href}
                      className={cn(
                        "flex flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors min-w-0",
                        active
                          ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Icon size={14} strokeWidth={1.75} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </nav>
      </div>

      <div>
        {/* Quote Card */}
        <div className="mx-3 mb-3 rounded-lg border-l-2 border-primary/40 bg-muted/30 p-3">
          <Quote size={12} className="mb-1 text-primary/60" />
          <p className="text-[11px] leading-relaxed text-muted-foreground italic">&quot;{quote.text}&quot;</p>
          <p className="mt-1 text-[10px] font-medium text-muted-foreground/70">— {quote.author}</p>
        </div>

        {/* Footer / Secondary navigation */}
        <div className="border-t p-2">
          {[
            { label: "Archive", icon: Archive },
            { label: "Settings", icon: Settings },
          ].map(({ label, icon: Icon }) => (
            <span
              key={label}
              title="Coming soon"
              className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground/40 select-none"
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

