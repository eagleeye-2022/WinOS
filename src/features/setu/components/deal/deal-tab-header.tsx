"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";

/** Shared header card used by every tab on /setu/deals/[dealId] so all tabs share one layout. */
export function DealTabHeader({
  icon: Icon,
  iconTone = "bg-[var(--setu-well)] text-[var(--setu-text-2)]",
  title,
  badge,
  subtitle,
  actions,
}: {
  icon: React.ElementType;
  iconTone?: string;
  title: React.ReactNode;
  badge?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="setu-card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3.5">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", iconTone)}>
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-semibold leading-tight">{title}</h2>
            {badge}
          </div>
          {subtitle && <p className="setu-text-2 mt-0.5 text-xs">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="setu-actions flex flex-wrap items-center gap-2">{actions}</div>}
    </section>
  );
}

/** Shared filter chip — neutral monochrome active state. */
export function DealFilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground"
      )}
    >
      <span>{label}</span>
      {count !== undefined && <span className={cn("text-xs tabular-nums", active ? "opacity-75" : "text-[var(--setu-text-3)]")}>{count}</span>}
    </button>
  );
}
