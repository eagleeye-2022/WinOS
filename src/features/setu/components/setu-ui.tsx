"use client";

import * as React from "react";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { Bot, CalendarDays, PenLine, Search, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { SOURCE_LABEL, STAGE_BY_ID } from "../constants";
import type { PipelineStageId, ProspectSource } from "../types";
import { avatarColor, initials } from "../utils";

// Proactiv-style building blocks for every Setu view. Surfaces, tiles and buttons are styled
// by the scoped classes in setu.css (`setu-card`, `setu-tile`, `setu-btn-*` …).

/** Scrollable page shell: glowing icon tile + gradient title, actions on the right. */
export function SetuPage({
  icon: Icon,
  title,
  description,
  actions,
  children,
  className,
}: {
  icon?: React.ElementType;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="h-full overflow-y-auto px-6 pb-10 pt-8 select-none">
      <div className={cn("mx-auto w-full max-w-[1500px] space-y-7", className)}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            {Icon && (
              <span className="setu-tile setu-tile-glow h-12 w-12">
                <Icon size={20} className="setu-accent-text" />
              </span>
            )}
            <div className="space-y-1">
              <h1 className="setu-heading text-3xl font-bold leading-tight">{title}</h1>
              {description && <p className="setu-text-2 max-w-2xl text-sm">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

type SetuButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  asChild?: boolean;
};

export const SetuButton = React.forwardRef<HTMLButtonElement, SetuButtonProps>(
  ({ variant = "secondary", size = "md", asChild, className, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        className={cn("setu-btn", `setu-btn-${variant}`, size === "sm" && "setu-btn-sm", className)}
        {...props}
      />
    );
  }
);
SetuButton.displayName = "SetuButton";

/** Keycap icon tile. */
export function IconTile({
  icon: Icon,
  size = 40,
  glow,
  className,
  iconClassName,
}: {
  icon: React.ElementType;
  size?: number;
  glow?: boolean;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn("setu-tile", glow && "setu-tile-glow", className)} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.45)} className={iconClassName} />
    </span>
  );
}

/** Rounded-square avatar tile with initials (the reference uses photo tiles). */
export function SetuAvatar({ name, size = "md", className }: { name: string; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_10px_-4px_rgba(0,0,0,0.45)] ring-1 ring-black/5 dark:ring-white/15",
        avatarColor(name),
        size === "xs" && "h-6 w-6 rounded-md text-[9px]",
        size === "sm" && "h-8 w-8 rounded-lg text-[10px]",
        size === "md" && "h-10 w-10 rounded-xl text-xs",
        size === "lg" && "h-14 w-14 rounded-2xl text-base",
        className
      )}
    >
      {initials(name)}
    </div>
  );
}

/** Overlapping avatar tiles, slightly rotated — the reference's "Trusted by" stack. */
export function AvatarStack({ names, max = 6 }: { names: string[]; max?: number }) {
  return (
    <div className="flex items-center">
      {names.slice(0, max).map((n, i) => (
        <div key={n} className="-ml-2.5 first:ml-0" style={{ transform: `rotate(${i % 2 === 0 ? -4 : 4}deg)`, zIndex: max - i }}>
          <SetuAvatar name={n} size="md" className="ring-2 ring-[var(--setu-canvas)] dark:ring-[var(--setu-canvas)]" />
        </div>
      ))}
    </div>
  );
}

/** Bordered pill ("Manu Arora · Tech Innovator" style). Pass a colour dot for stages / status. */
export function Pill({ className, dot, children }: { className?: string; dot?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "setu-text-2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--setu-line-strong)] bg-[var(--setu-raised)] px-2.5 py-0.5 text-[11px] font-medium",
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />}
      {children}
    </span>
  );
}

export function StageBadge({ stage }: { stage: PipelineStageId }) {
  const s = STAGE_BY_ID[stage];
  return <Pill dot={s.dot}>{s.short}</Pill>;
}

const SOURCE_ICON: Record<ProspectSource, React.ElementType> = {
  WHATSAPP_BOT: Bot,
  MEETING_121: Users2,
  MANUAL: PenLine,
};

export function SourceBadge({ source, label }: { source: ProspectSource; label?: string }) {
  const Icon = SOURCE_ICON[source];
  return (
    <span className="setu-text-3 inline-flex min-w-0 items-center gap-1 text-[11px] font-medium">
      <Icon size={12} className={cn("shrink-0", source === "WHATSAPP_BOT" && "text-emerald-500")} />
      <span className="truncate">{label ?? SOURCE_LABEL[source]}</span>
    </span>
  );
}

const TONE: Record<string, string> = {
  primary: "setu-accent-text",
  blue: "text-blue-500",
  orange: "text-orange-500",
  green: "text-green-500",
  violet: "text-violet-500",
  emerald: "text-emerald-500",
};

/** KPI card — keycap icon, gradient number, quiet label. */
export function StatTile({
  icon,
  value,
  label,
  hint,
  tone = "primary",
}: {
  icon: React.ElementType;
  value: React.ReactNode;
  label: string;
  hint?: string;
  tone?: keyof typeof TONE;
}) {
  return (
    <div className="setu-card setu-card-hover flex flex-col gap-4 p-5" title={hint}>
      <IconTile icon={icon} size={36} iconClassName={TONE[tone]} />
      <div>
        <div className="setu-heading text-3xl font-bold tabular-nums leading-none">{value}</div>
        <div className="setu-text-3 mt-1.5 text-xs font-medium">{label}</div>
      </div>
    </div>
  );
}

/** Bento card with a title (+ optional description) and an action on the right. */
export function SetuPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("setu-card p-6", className)}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && <p className="setu-text-2 mt-1 text-[13px] leading-relaxed">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Text link used for panel actions ("View all"). */
export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="setu-accent-text inline-flex shrink-0 items-center gap-1 text-xs font-semibold hover:underline">
      {children}
    </Link>
  );
}

/** Segmented control (All / Prospects / …). */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="setu-chip inline-flex flex-wrap gap-0.5 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-[var(--setu-canvas)] text-[var(--setu-text)] shadow-[inset_0_1px_0_var(--setu-highlight),0_1px_3px_rgba(0,0,0,0.2)] ring-1 ring-[var(--setu-line-strong)]"
                : "setu-text-3 hover:text-[var(--setu-text)]"
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="ml-1.5 tabular-nums opacity-60">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full max-w-xs">
      <Search size={15} className="setu-text-3 absolute left-3 top-1/2 -translate-y-1/2" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="setu-input h-10 pl-9" />
    </div>
  );
}

export function EmptyState({ icon = CalendarDays, text }: { icon?: React.ElementType; text: string }) {
  return (
    <div className="setu-card flex flex-col items-center justify-center gap-3 py-16 text-center">
      <IconTile icon={icon} size={44} glow iconClassName="setu-text-2" />
      <p className="setu-text-2 mt-2 text-sm">{text}</p>
    </div>
  );
}

/** Labelled form field wrapper for the Setu dialogs. */
export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="setu-text-2 text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

/** Small uppercase section label inside cards / dialogs. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h4 className="setu-text-3 mb-3 text-[11px] font-semibold uppercase tracking-[0.08em]">{children}</h4>;
}

/**
 * Smooth decorative line (the reference's analytics curve). `points` are 0–1 heights; the
 * optional `marker` index gets a dot + dashed guide.
 */
export function Sparkline({
  points,
  marker,
  className,
  height = 120,
}: {
  points: number[];
  marker?: number;
  className?: string;
  height?: number;
}) {
  const w = 400;
  const h = height;
  const pad = 10;
  const xy = points.map((p, i) => [(i / Math.max(1, points.length - 1)) * w, pad + (1 - p) * (h - pad * 2)] as const);
  const d = xy.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [px, py] = xy[i - 1];
    const cx = (px + x) / 2;
    return `${acc} C ${cx} ${py}, ${cx} ${y}, ${x} ${y}`;
  }, "");
  const id = React.useId().replace(/:/g, "");
  const m = marker !== undefined ? xy[marker] : undefined;
  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
      <defs>
        <linearGradient id={`fill-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--setu-accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--setu-accent)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`stroke-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="var(--setu-text-3)" stopOpacity="0" />
          <stop offset="25%" stopColor="var(--setu-text-3)" />
          <stop offset="100%" stopColor="var(--setu-accent)" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill={`url(#fill-${id})`} />
      <path d={d} fill="none" stroke={`url(#stroke-${id})`} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {m && (
        <line x1={m[0]} x2={m[0]} y1={0} y2={h} stroke="var(--setu-text-3)" strokeDasharray="3 4" strokeOpacity="0.5" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
      {/* The dot lives outside the stretched SVG so it stays round. */}
      {m && (
        <span
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--setu-card)] bg-[var(--setu-text)] shadow-[0_0_0_4px_var(--setu-accent-glow)]"
          style={{ left: `${(m[0] / w) * 100}%`, top: m[1] }}
        />
      )}
    </div>
  );
}
