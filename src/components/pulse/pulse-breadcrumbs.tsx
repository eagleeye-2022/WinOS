"use client";

// Breadcrumb trail + Back button for Pulse pages that have multiple tabs (Attendance, My Leaves,
// Team Leave, Reports). The bar only renders while a page registers its tab with usePulseCrumbs.
//
// The trail is built from two parts:
//   1. the route (pathname), mapped below — e.g. /pulse/leave/team → Pulse › Team Leave
//   2. extra steps a page adds for state that isn't in the URL path (its tab, an open request,
//      a selected team member…) via `usePulseCrumbs([...])`.
// Back goes to the step before the current one, so it always lands one level up the trail.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PulseCrumb {
  label: string;
  /** Navigate to this route when clicked. */
  href?: string;
  /** Or run this (e.g. switch a tab / close a sub-view). */
  onClick?: () => void;
}

type Registration = { token: object; crumbs: PulseCrumb[] } | null;

const PulseCrumbsContext = createContext<{
  register: (token: object, crumbs: PulseCrumb[]) => void;
  unregister: (token: object) => void;
} | null>(null);

/**
 * Adds page-level steps (tab, sub-view…) after the route's own steps. Called on every render of
 * the page, so the trail always shows the latest labels and click handlers.
 */
export function usePulseCrumbs(crumbs: PulseCrumb[]) {
  const ctx = useContext(PulseCrumbsContext);
  useEffect(() => {
    if (!ctx) return;
    const token = {};
    ctx.register(token, crumbs);
    return () => ctx.unregister(token);
  }, [ctx, crumbs]);
}

// ── Route → steps ────────────────────────────────────────────────────────────

const PULSE: PulseCrumb = { label: "Pulse", href: "/pulse/home" };
const TEAM_LEAVE: PulseCrumb = { label: "Team Leave", href: "/pulse/leave/team" };
const WHYFI: PulseCrumb = { label: "WhyFi School", href: "/pulse/whyfi-learning" };

function routeCrumbs(pathname: string): PulseCrumb[] {
  const p = pathname.replace(/\/+$/, "") || "/";
  let m: RegExpExecArray | null;

  if (p === "/pulse/home" || p === "/pulse") return [PULSE, { label: "Home", href: "/pulse/home" }];
  if (/^\/pulse\/(attendance|team-attendance|regularization)$/.test(p)) return [PULSE, { label: "Attendance", href: "/pulse/attendance" }];
  if (p === "/pulse/leave/team" || p === "/pulse/leave/policy") return [PULSE, TEAM_LEAVE];
  if (p === "/pulse/leave/policy/new")
    return [PULSE, TEAM_LEAVE, { label: "Leave Policy", href: "/pulse/leave/policy" }, { label: "New Leave Type" }];
  if (p === "/pulse/leave/adjust") return [PULSE, TEAM_LEAVE, { label: "Adjust Balance" }];
  if (p === "/pulse/leave" || p.startsWith("/pulse/leave/")) return [PULSE, { label: "My Leaves", href: "/pulse/leave" }];
  if (p === "/pulse/reports" || p === "/pulse/team-leave-payroll") return [PULSE, { label: "Reports", href: "/pulse/reports" }];
  if (p === "/pulse/profile") return [PULSE, { label: "Profile", href: "/pulse/profile" }];
  if ((m = /^\/pulse\/whyfi-learning\/([^/]+)\/tasks\/[^/]+$/.exec(p)))
    return [PULSE, WHYFI, { label: "List", href: `/pulse/whyfi-learning/${m[1]}` }, { label: "Task" }];
  if ((m = /^\/pulse\/whyfi-learning\/([^/]+)$/.exec(p))) return [PULSE, WHYFI, { label: "List", href: `/pulse/whyfi-learning/${m[1]}` }];
  if (p === "/pulse/whyfi-learning") return [PULSE, WHYFI];
  if (p === "/pulse/whyfi-effort-logs") return [PULSE, WHYFI, { label: "Effort Logs", href: "/pulse/whyfi-effort-logs" }];
  if (p === "/people" || p.startsWith("/people/")) return [PULSE, { label: "RTD Documents", href: "/people" }];
  return [PULSE];
}

// ── Provider + bar ───────────────────────────────────────────────────────────

/** Wraps a Pulse page: renders the trail bar on top and the page below it. */
export function PulseNavShell({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<Registration>(null);
  const register = useCallback((token: object, crumbs: PulseCrumb[]) => setEntry({ token, crumbs }), []);
  // A page unmounting only clears its own steps, never a newer registration's.
  const unregister = useCallback((token: object) => setEntry((prev) => (prev?.token === token ? null : prev)), []);
  const ctx = useMemo(() => ({ register, unregister }), [register, unregister]);

  return (
    <PulseCrumbsContext.Provider value={ctx}>
      <div className="flex h-full min-h-0 flex-col">
        {/* Only tabbed pages (they register their tab via usePulseCrumbs) get the trail + Back. */}
        {entry && <PulseBreadcrumbBar extra={entry} />}
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </PulseCrumbsContext.Provider>
  );
}

function PulseBreadcrumbBar({ extra }: { extra: Registration }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const base = routeCrumbs(pathname);
  const trail = [...base, ...(extra?.crumbs ?? [])];
  const parent = trail.length > 1 ? trail[trail.length - 2] : null;

  const activate = (index: number) => {
    const crumb = trail[index];
    if (!crumb) return;
    if (crumb.onClick) crumb.onClick();
    else if (crumb.href) router.push(crumb.href);
  };

  // Back goes one step up the trail; only Pulse Home (whose parent is itself) has nowhere to go.
  const canGoBack = Boolean(parent && (parent.onClick || (parent.href && parent.href !== pathname)));

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex h-11 shrink-0 items-center gap-2 border-b border-border/70 bg-card px-4 sm:px-6"
    >
      <button
        type="button"
        onClick={() => activate(trail.length - 2)}
        disabled={!canGoBack}
        title={parent ? `Back to ${parent.label}` : "Back"}
        className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border/80 px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <span className="h-4 w-px shrink-0 bg-border" />

      <ol className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap text-xs">
        {trail.map((crumb, i) => {
          const isLast = i === trail.length - 1;
          const clickable = !isLast && Boolean(crumb.onClick || crumb.href);
          return (
            <li key={`${i}-${crumb.label}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
              {clickable ? (
                <button
                  type="button"
                  onClick={() => activate(i)}
                  className="rounded px-1 py-0.5 font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-foreground dark:text-blue-400 dark:hover:bg-blue-500/10"
                >
                  {crumb.label}
                </button>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn("px-1 py-0.5", isLast ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
