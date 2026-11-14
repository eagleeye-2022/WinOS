// Shared building blocks for the Pulse module's HR-portal look (flat grey page, white cards with a
// title row, blue-underlined tabs, soft status pills). Every Pulse page uses these so the module
// looks the same everywhere, in light and dark mode.

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// ── Tones ────────────────────────────────────────────────────────────────────

export type PulseTone = "blue" | "green" | "red" | "amber" | "violet" | "gray";

/** Soft background + strong text, for pills and icon circles. */
export const TONE_SOFT: Record<PulseTone, string> = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  red: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  gray: "bg-muted text-muted-foreground",
};

/** Text-only tone, for status words. */
export const TONE_TEXT: Record<PulseTone, string> = {
  blue: "text-blue-600 dark:text-blue-400",
  green: "text-emerald-600 dark:text-emerald-400",
  red: "text-rose-600 dark:text-rose-400",
  amber: "text-amber-600 dark:text-amber-400",
  violet: "text-violet-600 dark:text-violet-400",
  gray: "text-muted-foreground",
};

/** Solid dot colour, for timelines and presence dots. */
export const TONE_DOT: Record<PulseTone, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  red: "bg-rose-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  gray: "bg-muted-foreground/50",
};

// ── Page ─────────────────────────────────────────────────────────────────────

/** The flat grey canvas every Pulse page sits on. */
export const PULSE_PAGE_BG = "bg-slate-100/70 dark:bg-background";

export function PulsePage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex h-full w-full flex-col overflow-y-auto", PULSE_PAGE_BG, className)}>{children}</div>;
}

// ── Card ─────────────────────────────────────────────────────────────────────

interface PulseCardProps {
  title?: ReactNode;
  /** Small grey line under the title (a date range, a count…). */
  subtitle?: ReactNode;
  icon?: ReactNode;
  iconTone?: PulseTone;
  /** Right side of the title row: a link, a button, a period picker. */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** White card with an optional title row (icon · title / subtitle · action). */
export function PulseCard({
  title,
  subtitle,
  icon,
  iconTone = "blue",
  action,
  children,
  className,
  bodyClassName,
}: PulseCardProps) {
  const hasHeader = Boolean(title || action);
  return (
    <section className={cn("rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)}>
      {hasHeader && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", TONE_SOFT[iconTone])}>
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="truncate text-[15px] font-semibold text-foreground">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn(hasHeader ? "px-5 pb-5 pt-4" : "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** "View all" style link for a card's title row. */
export function PulseCardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-xs font-semibold text-blue-600 hover:text-foreground hover:underline dark:text-blue-400">
      {children}
    </Link>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

export interface PulseTab {
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  /** Small count bubble after the label. */
  count?: number;
}

/** White strip of tabs with a blue underline on the active one. */
export function PulseTabs({ tabs, className }: { tabs: PulseTab[]; className?: string }) {
  return (
    <nav
      className={cn(
        "flex gap-1 overflow-x-auto rounded-lg border border-border/70 bg-card px-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className
      )}
    >
      {tabs.map((t) => {
        const cls = cn(
          "relative shrink-0 px-3.5 py-3 text-[13px] font-medium transition-colors",
          "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full",
          t.active
            ? "font-semibold text-blue-600 after:bg-blue-600 dark:text-blue-400 dark:after:bg-blue-400"
            : "text-muted-foreground after:bg-transparent hover:text-foreground"
        );
        const body = (
          <>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-px text-[10px] font-bold text-white">{t.count}</span>
            )}
          </>
        );
        return t.href ? (
          <Link key={t.label} href={t.href} aria-current={t.active ? "page" : undefined} className={cls}>
            {body}
          </Link>
        ) : (
          <button key={t.label} type="button" onClick={t.onClick} aria-current={t.active ? "page" : undefined} className={cls}>
            {body}
          </button>
        );
      })}
    </nav>
  );
}

/**
 * Tab strip that stays pinned (position: sticky, not fixed) at the top of a page that scrolls.
 *
 * Use it as the first child of a scroll container padded `p-4 sm:p-6` (or `px-4 py-4 sm:px-6
 * sm:py-6`). Sticky elements stop at the container's inner padding edge, which would leave a gap
 * above the tabs where scrolled content shows through — so the wrapper pulls itself up into the
 * padding (negative margin + negative top) and fills it with the solid page colour.
 */
export function PulseStickyTabs({ tabs, className }: { tabs: PulseTab[]; className?: string }) {
  return (
    <div
      className={cn(
        "sticky -top-4 z-20 -mx-4 -mt-4 shrink-0 px-4 pt-4 sm:-top-6 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6",
        // Opaque version of PULSE_PAGE_BG (slate-100 at 70% over white) so nothing shows through.
        "bg-[#f5f8fb] dark:bg-background",
        className
      )}
    >
      <PulseTabs tabs={tabs} className="shadow-sm" />
    </div>
  );
}

// ── Pills ────────────────────────────────────────────────────────────────────

export function StatusPill({ tone, children, className }: { tone: PulseTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", TONE_SOFT[tone], className)}>
      {children}
    </span>
  );
}
