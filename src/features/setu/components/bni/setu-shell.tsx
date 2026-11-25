"use client";

import { useMemo } from "react";
import Link from "next/link";
import { RotateCcw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { Input } from "@/components/ui/input";
import { BNI_CHAPTER } from "../../constants";
import { BNI_STAGE_BY_ID, setuStats, buildReferrals, isMember, isPipelineRecord, type BniStage } from "../../bni";
import { useSetuStore } from "../../provider";
import type { Deal } from "../../types";
import { isoDate } from "../../utils";
import { Breadcrumbs, SetuPage } from "../setu-ui";

// Page frame + shared building blocks for the Setu feature pages, in the Setu Figma style:
// small breadcrumb row with a live status pill, the page title with its actions, KPI cards,
// underlined feature tabs with count badges, filter panels, chip pills and section cards.

export type SetuTab = "meetings" | "pipeline" | "bot" | "contacts" | "referrals";

const TABS: { id: SetuTab; label: string; href: string }[] = [
  { id: "meetings", label: "121 Meetings", href: ROUTES.setu121 },
  { id: "pipeline", label: "Sales Pipeline", href: ROUTES.setuPipeline },
  { id: "bot", label: "WhatsApp Bot", href: ROUTES.setuWhatsappBot },
  { id: "contacts", label: "Contacts", href: ROUTES.setuContacts },
  { id: "referrals", label: "Referrals", href: ROUTES.setuReferrals },
];

export function SetuShell({ tab, title, actions, children }: { tab: SetuTab; title: string; actions?: React.ReactNode; children: React.ReactNode }) {
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
          <span className="font-medium">{BNI_CHAPTER.name}</span>
          <span className="opacity-50">•</span>
          <span className="tabular-nums">{health} pipeline health</span>
          <span className="opacity-50">•</span>
          <span className="tabular-nums">{stats.prospects} prospects</span>
        </span>
      </div>

      {/* Title row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="min-w-0 text-2xl font-semibold leading-tight">{title}</h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {/* KPI cards: a label and the figure. No icon tiles, one colour (Won). */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Pipeline health" value={health} />
        <Kpi label="Prospects" value={stats.prospects} />
        <Kpi label="121 meetings" value={stats.meetings121} hint={`${stats.members} BNI members`} />
        <Kpi label="Refs received" value={stats.refsReceived} />
        <Kpi label="Refs given" value={stats.refsGiven} />
        <Kpi label="Won" value={stats.won} valueTone="text-emerald-600 dark:text-emerald-400" />
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
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                active ? "border-[var(--setu-accent)] text-[var(--setu-accent)]" : "setu-text-2 border-transparent hover:text-[var(--setu-text)]"
              )}
            >
              {t.label}
              {count !== undefined && (
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none tabular-nums",
                    t.id === "bot"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                      : active
                        ? "bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]"
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

      {children}
    </SetuPage>
  );
}

function Kpi({ label, value, hint, valueTone }: { label: string; value: string | number; hint?: string; valueTone?: string }) {
  return (
    <div className="setu-card min-w-0 p-4">
      <p className="setu-text-2 truncate text-xs font-medium">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold leading-none tabular-nums", valueTone)}>{value}</p>
      {hint && <p className="setu-text-3 mt-2 truncate text-[11px]">{hint}</p>}
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

/** "Clear filters" text link. */
export function ClearFilters({ onClick, show }: { onClick: () => void; show: boolean }) {
  if (!show) return null;
  return (
    <button type="button" onClick={onClick} className="setu-accent-text inline-flex items-center gap-1 px-1 text-xs font-medium hover:underline">
      <RotateCcw size={12} /> Clear filters
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
        active ? "bg-[var(--setu-solid)] text-white" : "bg-[var(--setu-well)] text-[var(--setu-text-2)] hover:text-[var(--setu-text)]"
      )}
    >
      {Icon && <Icon size={12} />}
      {label}
      {count !== undefined && <span className={cn("text-[11px] tabular-nums", active ? "text-white/75" : "text-[var(--setu-text-3)]")}>{count}</span>}
    </button>
  );
}

/** Card with an icon-tile header (icon, title, description, optional badge and action). */
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
          {badge && <span className="rounded-md bg-[var(--setu-well)] px-2 py-0.5 text-[11px] font-medium text-[var(--setu-text-2)]">{badge}</span>}
          {action}
        </div>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

/** Table header row + body (Meetings-list style). */
export function DataTable({ head, children, minWidth = 860 }: { head: string[]; children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="setu-scroll-x overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-[var(--setu-line)] text-xs text-[var(--setu-text-2)]">
            {head.map((h, i) => (
              <th key={`${h}-${i}`} className={cn("px-4 py-3 font-medium", i === head.length - 1 && "text-right")}>
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

/** Small tag ("Follow up", "5 refs", "Converted"). */
export function Tag({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium", className)}>{children}</span>;
}

/**
 * Tag tones. Neutral by default; colour only where it carries meaning: blue = prospect / received
 * (accent), green = good outcome, amber = needs action.
 */
export const TAG_TONE = {
  neutral: "bg-[var(--setu-well)] text-[var(--setu-text-2)]",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  green: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
} as const;

/** A pipeline stage as a neutral tag with the stage's colour dot (the dot is the only stage colour). */
export function StageTag({ stage }: { stage: BniStage }) {
  const st = BNI_STAGE_BY_ID[stage];
  return (
    <Tag className={TAG_TONE.neutral}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", st.dot)} />
      {st.label}
    </Tag>
  );
}
