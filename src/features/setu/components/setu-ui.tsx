"use client";

import * as React from "react";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { ChevronDown, ChevronRight, Construction, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import { useSetuStore } from "../provider";
import { avatarColor, initials } from "../utils";

/** Read-only rich text (notes, call summaries, proposal reasons) in Setu's type scale and colours. */
export const SETU_RICH_VIEW =
  "prose prose-sm max-w-none text-sm leading-relaxed text-[var(--setu-text)] prose-p:my-1 prose-headings:text-[var(--setu-text)] prose-strong:text-[var(--setu-text)] break-words dark:prose-invert";

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

/** "Setu › Networking › Sales Pipeline" — the last crumb is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ label: "Setu", href: ROUTES.setu121 }, ...items];
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {all.map((c, i) => {
        const last = i === all.length - 1;
        return (
          <React.Fragment key={`${c.label}-${i}`}>
            {i > 0 && <ChevronRight size={13} className="setu-text-3 shrink-0" />}
            {c.href && !last ? (
              <Link href={c.href} className="transition-colors hover:text-primary">
                {c.label}
              </Link>
            ) : (
              <span className={cn(last && "font-medium text-foreground")}>{c.label}</span>
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
    <div className="h-full overflow-y-auto bg-background" data-scroll-key="setu-page">
      {/* Same gutters as the other WinOS pages (p-6, full width). */}
      <div className={cn("w-full space-y-6 p-4 pb-10 sm:p-6 sm:pb-10", className)}>{children}</div>
    </div>
  );
}

// ── Controls ──────────────────────────────────────────────────────────────────

type SetuButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "solid" | "muted" | "secondary" | "soft" | "whatsapp" | "ghost";
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
            "setu-input flex h-9 cursor-pointer items-center gap-1.5 border px-3 text-xs text-foreground transition-colors hover:bg-accent focus-visible:outline-none",
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

/** Search field with the magnifier (list toolbars). */
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-[220px] flex-1">
      <Search size={15} className="setu-text-3 absolute left-3 top-1/2 -translate-y-1/2" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="setu-input h-9 pl-9" />
    </div>
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
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card px-6 py-20 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
        <Construction size={22} />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="setu-text-2 max-w-md text-sm">{text ?? "This section is coming soon."}</p>
    </div>
  );
}
