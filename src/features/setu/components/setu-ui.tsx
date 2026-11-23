"use client";

import * as React from "react";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { ChevronDown, ChevronRight, Construction } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants/routes";
import { STAGE_BADGE, STAGE_BY_ID, STAGE_DOT } from "../constants";
import { toast } from "@/components/shared/toast";
import { useSetuStore } from "../provider";
import type { DealStage } from "../types";
import { avatarColor, initials } from "../utils";

// Shared building blocks for the Setu CRM pages. Surfaces and buttons are styled by the scoped
// classes in setu.css (`setu-card`, `setu-btn-*` …).

// ── Current user ──────────────────────────────────────────────────────────────

/** The signed-in user's display name. */
export function useSetuUserName(): string {
  return useSetuStore((s) => s.me.name);
}

/**
 * Awaits a store action: shows `done` on success and the server's message on failure.
 * Resolves to the action's result, or `undefined` when it failed.
 */
export async function attempt<T>(action: Promise<T>, done?: string): Promise<T | undefined> {
  try {
    const result = await action;
    if (done) toast.success(done);
    return result;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Something went wrong.");
    return undefined;
  }
}

// ── Layout ────────────────────────────────────────────────────────────────────

export interface Crumb {
  label: string;
  href?: string;
}

/** "CRM › Sales › Tasks" — the last crumb is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ label: "CRM", href: ROUTES.setuTasks }, ...items];
  return (
    <nav aria-label="Breadcrumb" className="setu-text-2 flex min-w-0 flex-wrap items-center gap-1 text-xs">
      {all.map((c, i) => {
        const last = i === all.length - 1;
        return (
          <React.Fragment key={`${c.label}-${i}`}>
            {i > 0 && <ChevronRight size={13} className="setu-text-3 shrink-0" />}
            {c.href && !last ? (
              <Link href={c.href} className="hover:text-[var(--setu-text)]">
                {c.label}
              </Link>
            ) : (
              <span className={cn(last && "font-semibold text-[var(--setu-text)]")}>{c.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/** Page wrapper: one scroll area with the standard Setu gutters. */
export function SetuPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="h-full overflow-y-auto" data-scroll-key="setu-page">
      <div className={cn("mx-auto w-full max-w-[1600px] space-y-5 px-4 pb-10 pt-5 sm:px-6", className)}>{children}</div>
    </div>
  );
}

// ── Controls ──────────────────────────────────────────────────────────────────

type SetuButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "soft" | "whatsapp" | "ghost";
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

/** "Owner: All Reps ▾" — a single-choice filter. Without `label` it shows just the value. */
export function FilterDropdown({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const current = options.find((o) => o.value === value)?.label ?? options[0]?.label;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)] px-3.5 text-xs text-[var(--setu-text)] transition-colors hover:border-[var(--setu-line-strong)] focus-visible:border-[var(--setu-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--setu-accent-ring)] data-[state=open]:border-[var(--setu-accent)]",
            className
          )}
        >
          {label && <span className="setu-text-2">{label}:</span>}
          <span className={cn("truncate", label && "font-semibold")}>{current}</span>
          <ChevronDown size={15} className="setu-text-2 ml-auto shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value || "all"} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Round initials avatar. */
export function SetuAvatar({ name, size = "sm", className }: { name: string; size?: "xs" | "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        avatarColor(name),
        size === "xs" && "h-5 w-5 text-[8px]",
        size === "sm" && "h-6 w-6 text-[10px]",
        size === "md" && "h-9 w-9 text-xs",
        className
      )}
    >
      {initials(name)}
    </span>
  );
}

/** "● Negotiation Stage" pill. */
export function StageBadge({ stage, suffix = " Stage", className }: { stage: DealStage; suffix?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        STAGE_BADGE[stage],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", STAGE_DOT[stage])} />
      {STAGE_BY_ID[stage].label}
      {suffix}
    </span>
  );
}

/** Labelled form field; `required` adds the red asterisk. */
export function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-xs font-semibold">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

/** Placeholder for pages and tabs whose design hasn't been delivered yet. */
export function ComingSoon({ title, text }: { title: string; text?: string }) {
  return (
    <div className="setu-card flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
        <Construction size={22} />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="setu-text-2 max-w-md text-sm">{text ?? "This section is coming soon."}</p>
    </div>
  );
}

/** A Setu page with no design yet: breadcrumb, title and a Coming-soon card. */
export function ComingSoonPage({ title, crumbs }: { title: string; crumbs?: Crumb[] }) {
  return (
    <SetuPage>
      <Breadcrumbs items={crumbs ?? [{ label: "Sales" }, { label: title }]} />
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <ComingSoon
        title={`${title} is coming soon`}
        text="This page will be built once its design is ready. Meanwhile, manage leads and deals from the Tasks board."
      />
      <div className="flex justify-center">
        <SetuButton variant="primary" asChild>
          <Link href={ROUTES.setuTasks}>Open Tasks board</Link>
        </SetuButton>
      </div>
    </SetuPage>
  );
}
