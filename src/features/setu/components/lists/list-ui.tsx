"use client";

import Link from "next/link";
import { ArrowRightLeft, Check, EllipsisVertical, Eye, FilterX, PencilLine, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEAL_STAGES, STAGE_BY_ID } from "../../constants";
import { useSetuStore } from "../../provider";
import type { Deal } from "../../types";
import { Breadcrumbs, attempt, type Crumb } from "../setu-ui";

// Shared building blocks for the Setu list pages (Leads, Deals, Contacts, Calls) and the Dashboard.

export function ListHeader({ crumbs, title, subtitle, actions }: { crumbs: Crumb[]; title: string; subtitle: string; actions?: React.ReactNode }) {
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight">{title}</h1>
          <p className="setu-text-2 mt-1 text-sm">{subtitle}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </>
  );
}

/** KPI tile: label, big value, optional hint. */
export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]",
  valueTone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  valueTone?: string;
}) {
  return (
    <div className="setu-card flex items-center gap-3 px-4 py-4">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="setu-text-2 text-[11px] font-semibold uppercase tracking-wider">{label}</p>
        <p className={cn("truncate text-xl font-bold leading-tight tabular-nums", valueTone)}>{value}</p>
        {hint && <p className="setu-text-3 truncate text-[11px]">{hint}</p>}
      </div>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-[220px] flex-1">
      <Search size={15} className="setu-text-3 absolute left-3 top-1/2 -translate-y-1/2" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="setu-input h-9 pl-9" />
    </div>
  );
}

/** Table shell with the Setu header row style. */
export function ListTable({ head, children, minWidth = 900 }: { head: string[]; children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="setu-card overflow-hidden">
      <div className="setu-scroll-x overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead>
            <tr className="setu-text-2 bg-[var(--setu-well)] text-left text-[11px] font-semibold uppercase tracking-wider">
              {head.map((h, i) => (
                <th key={h || i} className={cn("px-4 py-3 font-semibold", i === head.length - 1 && !h && "w-12")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--setu-line)]">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="setu-text-2 px-6 py-14 text-center text-sm">
        {text}
      </td>
    </tr>
  );
}

/** ⋮ for a lead / deal row: open, edit, move to another stage. */
export function DealRowMenu({ deal, onEdit }: { deal: Deal; onEdit: () => void }) {
  const moveDeal = useSetuStore((s) => s.moveDeal);
  const options = DEAL_STAGES;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Actions"
          className="setu-text-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-[var(--setu-soft)]"
        >
          <EllipsisVertical size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem asChild>
          <Link href={ROUTES.setuDeal(deal.id)}>
            <Eye size={14} /> Open
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}>
          <PencilLine size={14} /> Edit
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ArrowRightLeft size={14} className="mr-2" /> Move to stage
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {options.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  disabled={s.id === deal.stage}
                  onSelect={() => void attempt(moveDeal(deal.id, s.id), `${deal.company} → ${STAGE_BY_ID[s.id].label}`)}
                >
                  {s.label}
                  {s.id === deal.stage && <Check size={14} className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Resets a page's filters. */
export function ClearButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Clear filters"
      title="Clear filters"
      className="setu-text-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg hover:bg-[var(--setu-soft)] disabled:cursor-default disabled:opacity-40"
    >
      <FilterX size={17} />
    </button>
  );
}
