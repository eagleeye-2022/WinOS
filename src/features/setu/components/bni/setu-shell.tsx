"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarHeart, HeartPulse, Link2, Search, TrendingUp, UserRoundSearch, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { Input } from "@/components/ui/input";
import { BNI_CHAPTER } from "../../constants";
import { setuStats, buildReferrals, isMember, isPipelineRecord } from "../../bni";
import { useSetuStore } from "../../provider";
import type { Deal } from "../../types";
import { isoDate } from "../../utils";
import { Breadcrumbs, SetuPage } from "../setu-ui";

// Page frame + shared building blocks for the Setu feature pages, in the Setu Figma style:
// small breadcrumb row with a live status pill, a large page title with its actions, KPI cards,
// underlined feature tabs with count badges, filter panels, chip pills and section cards.

export type SetuTab = "meetings" | "pipeline" | "bot" | "contacts" | "referrals";

const TABS: { id: SetuTab; label: string; href: string }[] = [
  { id: "meetings", label: "121 Meetings", href: ROUTES.setu121 },
  { id: "pipeline", label: "Sales Pipeline", href: ROUTES.setuPipeline },
  { id: "bot", label: "WhatsApp Bot", href: ROUTES.setuWhatsappBot },
  { id: "contacts", label: "Contacts", href: ROUTES.setuContacts },
  { id: "referrals", label: "Referrals", href: ROUTES.setuReferrals },
];

export function SetuShell({
  tab,
  title,
  subtitle,
  hint,
  actions,
  children,
}: {
  tab: SetuTab;
  title: string;
  subtitle?: string;
  /** "How this feeds the rest of Setu" strip under the tabs. */
  hint?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const deals = useSetuStore((s) => s.deals);
  const notes = useSetuStore((s) => s.notes);
  const meetings = useSetuStore((s) => s.meetings);
  const today = isoDate(new Date());
  const stats = useMemo(() => setuStats(deals, notes, meetings, today), [deals, notes, meetings, today]);
  const counts = useMemo<Partial<Record<SetuTab, string | number>>>(
    () => ({
      meetings: stats.meetings121,
      pipeline: deals.filter(isPipelineRecord).length,
      bot: "Setup",
      contacts: deals.filter((d) => d.bni?.kind !== "OPPORTUNITY").length,
      referrals: buildReferrals(deals, notes).length,
    }),
    [deals, notes, stats.meetings121]
  );
  const current = TABS.find((t) => t.id === tab);
  const health = stats.pipelineHealth === null ? "—" : `${stats.pipelineHealth}%`;

  return (
    <SetuPage>
      {/* Breadcrumb + live status pill */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs items={[{ label: "Networking" }, { label: current?.label ?? "" }]} />
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-full bg-[var(--setu-accent-soft)] px-3 py-1 text-[11px] font-medium text-[var(--setu-accent)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--setu-accent)]" />
          <span className="font-semibold">{BNI_CHAPTER.name}</span>
          <span className="opacity-50">•</span>
          <span>{health} Pipeline Health</span>
          <span className="opacity-50">•</span>
          <span>{stats.prospects} Prospects</span>
        </span>
      </div>

      {/* Title row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="setu-text-2 mt-1 text-sm">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Pipeline Health" value={health} hint="Open prospects moving (30 days)" icon={HeartPulse} tone="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" />
        <Kpi label="Prospects" value={stats.prospects} hint="On the sales pipeline" icon={UserRoundSearch} tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400" />
        <Kpi label="121 Meetings" value={stats.meetings121} hint={`${stats.members} BNI members`} icon={CalendarHeart} tone="bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" />
        <Kpi label="Refs Received" value={stats.refsReceived} hint="From chapter members" icon={Link2} tone="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400" />
        <Kpi label="Refs Given" value={stats.refsGiven} hint="To chapter members" icon={TrendingUp} tone="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400" />
        <Kpi label="Won" value={stats.won} hint="Deals closed" icon={BadgeCheck} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" valueTone="text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* Feature tabs */}
      <nav className="setu-scroll-x flex overflow-x-auto border-b border-[var(--setu-line)]" aria-label="Setu features">
        {TABS.map((t) => {
          const active = t.id === tab;
          const count = counts[t.id];
          return (
            <Link
              key={t.id}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-medium transition-colors",
                active ? "border-[var(--setu-accent)] font-semibold text-[var(--setu-accent)]" : "setu-text-2 border-transparent hover:text-[var(--setu-text)]"
              )}
            >
              {t.label}
              {count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    t.id === "bot"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                      : active
                        ? "bg-[var(--setu-accent)] text-white"
                        : "bg-[var(--setu-well)] text-[var(--setu-text-2)]"
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {hint && <HintStrip>{hint}</HintStrip>}

      {children}
    </SetuPage>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  valueTone,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ElementType;
  tone: string;
  valueTone?: string;
}) {
  return (
    <div className="setu-card flex items-start justify-between gap-2 p-4">
      <div className="min-w-0">
        <p className="setu-text-2 truncate text-[10px] font-semibold uppercase tracking-wider">{label}</p>
        <p className={cn("mt-1.5 text-2xl font-bold leading-none tracking-tight tabular-nums", valueTone)}>{value}</p>
        <p className="setu-text-3 mt-1.5 truncate text-[11px]">{hint}</p>
      </div>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon size={17} />
      </span>
    </div>
  );
}

/** Tinted info strip ("WEEKLY PACE"-style): icon tile + text + optional action. */
export function HintStrip({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--setu-accent-ring)]/60 bg-[var(--setu-accent-soft)] px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--setu-card)] text-[var(--setu-accent)] shadow-sm">
        <Link2 size={16} />
      </span>
      <div className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--setu-text-2)]">
        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--setu-text-2)]">How it flows</p>
        {children}
      </div>
      {action}
    </div>
  );
}

/** White panel holding a page's search + filters, with an optional chip row underneath. */
export function FilterPanel({ children, chips }: { children: React.ReactNode; chips?: React.ReactNode }) {
  return (
    <div className="setu-card p-3">
      <div className="flex flex-wrap items-center gap-2.5">{children}</div>
      {chips && <div className="mt-3 flex flex-wrap items-center gap-2">{chips}</div>}
    </div>
  );
}

/** Grey search field (filter panels). */
export function PanelSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-[240px] flex-1">
      <Search size={15} className="setu-text-3 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-xl border-transparent bg-[var(--setu-well)] pl-9 pr-8 text-[13px] shadow-none placeholder:text-[var(--setu-text-3)] focus-visible:border-[var(--setu-accent)] focus-visible:ring-2 focus-visible:ring-[var(--setu-accent-ring)]"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="setu-text-3 absolute right-2.5 top-1/2 -translate-y-1/2 hover:text-[var(--setu-text)]">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** "↻ Clear Filters" text link. */
export function ClearFilters({ onClick, show }: { onClick: () => void; show: boolean }) {
  if (!show) return null;
  return (
    <button type="button" onClick={onClick} className="setu-accent-text px-1 text-xs font-semibold hover:underline">
      ↻ Clear Filters
    </button>
  );
}

/** Filter pill: solid blue when active ("All 22"), grey otherwise. */
export function ChipPill({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ElementType;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-[#1d4ed8] text-white shadow-sm dark:bg-blue-600" : "bg-[var(--setu-well)] text-[var(--setu-text-2)] hover:text-[var(--setu-text)]"
      )}
    >
      {Icon && <Icon size={12} />}
      {label}
      {count !== undefined && (
        <span className={cn("rounded-full px-1.5 text-[10px] font-bold tabular-nums", active ? "bg-white/20 text-white" : "bg-[var(--setu-card)] text-[var(--setu-text-2)]")}>{count}</span>
      )}
    </button>
  );
}

/** Card with an icon-tile header ("📅 Meeting Information  ·  CORE SETUP"). */
export function SectionCard({
  icon: Icon,
  title,
  description,
  badge,
  action,
  children,
  className,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  badge?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("setu-card p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
            <Icon size={17} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-tight">{title}</h3>
            {description && <p className="setu-text-2 mt-0.5 text-xs">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badge && <span className="rounded-md bg-[var(--setu-accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--setu-accent)]">{badge}</span>}
          {action}
        </div>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

/** Uppercase table header row + body (Meetings-list style). */
export function DataTable({ head, children, minWidth = 860 }: { head: string[]; children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="setu-scroll-x overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-[var(--setu-line)] text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
            {head.map((h, i) => (
              <th key={`${h}-${i}`} className={cn("px-4 py-3 font-semibold", i === head.length - 1 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--setu-line)]">{children}</tbody>
      </table>
    </div>
  );
}

/** Where a record opens: a member's 121 record, or the prospect workspace. */
export function recordHref(deal: Deal, tab?: string): string {
  if (isMember(deal)) return ROUTES.setuMember(deal.id);
  return tab ? `${ROUTES.setuDeal(deal.id)}?tab=${tab}` : ROUTES.setuDeal(deal.id);
}

/** Breadcrumb trail to a record ("Sales Pipeline › Antra Raje" / "121 Meetings › Shreshtha"). */
export function recordCrumbs(deal: Deal | undefined): { label: string; href?: string }[] {
  if (!deal) return [{ label: "Networking" }];
  return isMember(deal)
    ? [{ label: "121 Meetings", href: ROUTES.setu121 }, { label: deal.contactName, href: ROUTES.setuMember(deal.id) }]
    : [{ label: "Sales Pipeline", href: ROUTES.setuPipeline }, { label: deal.contactName, href: ROUTES.setuDeal(deal.id) }];
}

/** Small coloured pill (stage tags, "Follow Up", "5 Refs", "Converted ✓"). */
export function Tag({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-semibold", className)}>{children}</span>;
}

export const TAG_TONE = {
  green: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
  pink: "bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
} as const;
