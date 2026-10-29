"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Bot, CalendarDays, PenLine, Search, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { SOURCE_LABEL, STAGE_BY_ID } from "../constants";
import type { PipelineStageId, ProspectSource } from "../types";
import { avatarColor, initials } from "../utils";

// Proactiv-style building blocks for every Setu tab. Surfaces, tiles and buttons are styled
// by the scoped classes in setu.css (`setu-card`, `setu-tile`, `setu-btn-*` …). The page
// header, stat chips and tab bar live in SetuShell; each tab renders a SetuSection.

/** A tab's content: section title + actions row, then the tab body. */
export function SetuSection({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="setu-heading text-lg font-semibold">{title}</h2>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

type SetuButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "success" | "ghost";
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

/** Round initials avatar. */
export function SetuAvatar({ name, size = "md", className }: { name: string; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_10px_-4px_rgba(0,0,0,0.45)] ring-1 ring-black/5 dark:ring-white/15",
        avatarColor(name),
        size === "xs" && "h-6 w-6 text-[9px]",
        size === "sm" && "h-8 w-8 text-[10px]",
        size === "md" && "h-10 w-10 text-xs",
        size === "lg" && "h-14 w-14 text-base",
        className
      )}
    >
      {initials(name)}
    </div>
  );
}

/** Bordered pill. Pass a colour dot for stages / status. */
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

/** Card with a title and an optional action on the right. */
export function SetuPanel({
  title,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("setu-card p-6", className)}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Filter chip row (All / Prospects / …). */
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
            {o.count !== undefined && <span className="ml-1.5 tabular-nums opacity-60">({o.count})</span>}
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
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full", className)}>
      <Search size={15} className="setu-text-3 absolute left-3.5 top-1/2 -translate-y-1/2" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="setu-input h-11 pl-10" />
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
