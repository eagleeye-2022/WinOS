"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Check,
  Clock,
  Contact as ContactIcon,
  Download,
  ExternalLink,
  FilterX,
  Handshake,
  Mail,
  MessageCircle,
  Phone,
  RotateCcw,
  Search,
  Sparkles,
  UserCheck,
  UserRoundSearch,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { useSetuStore } from "../../provider";
import { formatDate, formatDateTime, isoDate, phoneDigits, relativeDay } from "../../utils";
import {
  RELATIONSHIP_LABEL,
  buildContacts,
  downloadCsv,
  matchesText,
  toCsv,
  type Relationship,
} from "../../insights";
import { FilterDropdown, SetuAvatar, SetuButton, SetuPage } from "../setu-ui";
import { ListHeader } from "./list-ui";

const RELATIONSHIPS: readonly (Relationship | "all")[] = ["all", "CUSTOMER", "ACTIVE_DEAL", "LEAD", "LOST"];

const RELATIONSHIP_CONFIG: Record<
  Relationship,
  { label: string; badge: string; dot: string; icon: React.ElementType }
> = {
  CUSTOMER: {
    label: "Customer",
    badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400",
    dot: "bg-emerald-400",
    icon: BadgeCheck,
  },
  ACTIVE_DEAL: {
    label: "Active Deal",
    badge: "border-indigo-500/20 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400",
    dot: "bg-indigo-400",
    icon: Handshake,
  },
  LEAD: {
    label: "Lead",
    badge: "border-sky-500/20 bg-sky-500/10 text-sky-500 dark:text-sky-400",
    dot: "bg-sky-400",
    icon: UserRoundSearch,
  },
  LOST: {
    label: "Lost",
    badge: "border-zinc-500/20 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400",
    dot: "bg-zinc-400",
    icon: RotateCcw,
  },
};

/**
 * Setu CRM → Contacts Directory
 * High-craft executive client contacts directory with interactive relationship filters,
 * quick direct reach-out actions, and multi-deal relationship context.
 */
export function ContactsPage() {
  const router = useRouter();
  const deals = useSetuStore((s) => s.deals);
  const meetings = useSetuStore((s) => s.meetings);

  const [q, setQ] = useUrlState("q", "");
  const [rel, setRel] = useUrlState<Relationship | "all">("type", "all", { allowed: RELATIONSHIPS });
  const [owner, setOwner] = useUrlState("owner", "");

  const today = isoDate(new Date());
  const contacts = useMemo(() => buildContacts(deals, meetings), [deals, meetings]);
  const owners = useMemo(() => [...new Set(contacts.flatMap((c) => c.ownerNames))].sort(), [contacts]);

  const count = (r: Relationship) => contacts.filter((c) => c.relationship === r).length;

  const rows = useMemo(() => {
    return contacts.filter(
      (c) =>
        (rel === "all" || c.relationship === rel) &&
        (!owner || c.ownerNames.includes(owner)) &&
        matchesText(q, c.name, c.company, c.email, c.phone, c.role)
    );
  }, [contacts, rel, owner, q]);

  const filtered = q !== "" || rel !== "all" || owner !== "";
  const activeFiltersCount = (q ? 1 : 0) + (rel !== "all" ? 1 : 0) + (owner ? 1 : 0);

  const clearAllFilters = () => {
    setQ("");
    setRel("all");
    setOwner("");
  };

  const exportCsv = () => {
    if (!rows.length) return toast.info("No contacts to export");
    downloadCsv(
      `setu-contacts-${today}.csv`,
      toCsv([
        ["Name", "Role", "Company", "Email", "Phone", "Relationship", "Deals", "Owners", "Last Touch"],
        ...rows.map((c) => [
          c.name,
          c.role,
          c.company,
          c.email,
          c.phone,
          RELATIONSHIP_LABEL[c.relationship],
          c.dealIds.length,
          c.ownerNames.join("; "),
          formatDateTime(c.lastTouch),
        ]),
      ])
    );
    toast.success(`Exported ${rows.length} contacts to CSV`);
  };

  return (
    <SetuPage className="space-y-5 pb-12">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <ListHeader
        crumbs={[{ label: "Sales" }, { label: "Contacts" }]}
        title="Client Contacts"
        subtitle="Decision makers, sponsors, and external meeting attendees across your client portfolio."
        actions={
          <div className="flex items-center gap-2.5">
            <SetuButton
              onClick={exportCsv}
              disabled={rows.length === 0}
              variant="secondary"
            >
              <Download />
              <span>Export CSV</span>
            </SetuButton>
          </div>
        }
      />

      {/* ── INTERACTIVE KPI STRIP (Relationship Filter Cards) ────────────── */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {/* Card 1: All Contacts */}
        <button
          type="button"
          onClick={() => setRel("all")}
          className={cn(
            "group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:border-[var(--setu-accent)] hover:shadow-md",
            rel === "all"
              ? "border-[var(--setu-accent)] bg-[var(--setu-card)] ring-2 ring-[var(--setu-accent-ring)]"
              : "border-[var(--setu-line)] bg-[var(--setu-card)]"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              All Contacts
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {contacts.length}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              Across all leads & deals
            </p>
          </div>
        </button>

        {/* Card 2: Customers */}
        <button
          type="button"
          onClick={() => setRel(rel === "CUSTOMER" ? "all" : "CUSTOMER")}
          className={cn(
            "group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:border-[var(--setu-accent)] hover:shadow-md",
            rel === "CUSTOMER"
              ? "border-[var(--setu-accent)] bg-[var(--setu-card)] ring-2 ring-[var(--setu-accent-ring)]"
              : "border-[var(--setu-line)] bg-[var(--setu-card)]"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              Customers
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <BadgeCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {count("CUSTOMER")}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              Closed-won client partners
            </p>
          </div>
        </button>

        {/* Card 3: Active Deals */}
        <button
          type="button"
          onClick={() => setRel(rel === "ACTIVE_DEAL" ? "all" : "ACTIVE_DEAL")}
          className={cn(
            "group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:border-[var(--setu-accent)] hover:shadow-md",
            rel === "ACTIVE_DEAL"
              ? "border-[var(--setu-accent)] bg-[var(--setu-card)] ring-2 ring-[var(--setu-accent-ring)]"
              : "border-[var(--setu-line)] bg-[var(--setu-card)]"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              Active Deals
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
              <Handshake className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {count("ACTIVE_DEAL")}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              In Proposal or Negotiation
            </p>
          </div>
        </button>

        {/* Card 4: Leads */}
        <button
          type="button"
          onClick={() => setRel(rel === "LEAD" ? "all" : "LEAD")}
          className={cn(
            "group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:border-[var(--setu-accent)] hover:shadow-md",
            rel === "LEAD"
              ? "border-[var(--setu-accent)] bg-[var(--setu-card)] ring-2 ring-[var(--setu-accent-ring)]"
              : "border-[var(--setu-line)] bg-[var(--setu-card)]"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              Prospect Leads
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
              <UserRoundSearch className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {count("LEAD")}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              Discovery & meeting stage
            </p>
          </div>
        </button>
      </div>

      {/* ── FILTER TOOLBAR ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] p-3 shadow-sm">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          {/* Search Box */}
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--setu-text-3)]" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search contact, company, role, email, phone..."
              className="h-9 w-full rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)] pl-9 pr-8 text-xs text-[var(--setu-text)] placeholder:text-[var(--setu-text-3)] focus:border-[var(--setu-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--setu-accent-ring)]"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[var(--setu-text-3)] hover:text-[var(--setu-text)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-[var(--setu-line)] bg-[var(--setu-card)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--setu-text-3)] sm:inline-block">
                /
              </kbd>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              label="Relationship"
              value={rel}
              onChange={(v) => setRel(v as Relationship | "all")}
              options={RELATIONSHIPS.map((r) => ({
                value: r,
                label: r === "all" ? "All Relationships" : RELATIONSHIP_LABEL[r],
              }))}
              className="h-9 rounded-xl text-xs"
            />
            <FilterDropdown
              label="Assigned Rep"
              value={owner}
              onChange={setOwner}
              options={[{ value: "", label: "All Reps" }, ...owners.map((o) => ({ value: o, label: o }))]}
              className="h-9 rounded-xl text-xs"
            />

            {/* Clear All Button */}
            {filtered && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)] px-3 text-xs font-medium text-[var(--setu-text-2)] transition-all hover:bg-[var(--setu-soft)] hover:text-[var(--setu-text)]"
              >
                <FilterX className="h-3.5 w-3.5 text-rose-500" />
                <span>Reset ({activeFiltersCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Counter & Relationship Tabs */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between border-t border-[var(--setu-line)] pt-2.5 text-xs text-[var(--setu-text-3)]">
          <div className="flex items-center gap-2">
            <span>
              Showing <span className="font-semibold text-[var(--setu-text)]">{rows.length}</span> of {contacts.length} contacts
            </span>
            {filtered && (
              <span className="inline-flex items-center rounded-full bg-[var(--setu-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--setu-accent)]">
                Filtered view
              </span>
            )}
          </div>

          {/* Quick relationship tabs */}
          <div className="hidden items-center gap-1.5 sm:flex">
            {RELATIONSHIPS.map((r) => {
              const active = rel === r;
              const countVal = r === "all" ? contacts.length : count(r);
              return (
                <button
                  key={r}
                  onClick={() => setRel(r)}
                  className={cn(
                    "rounded-lg px-2 py-0.5 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-[var(--setu-soft)] text-[var(--setu-text)] font-semibold"
                      : "text-[var(--setu-text-3)] hover:text-[var(--setu-text)]"
                  )}
                >
                  {r === "all" ? "All" : RELATIONSHIP_LABEL[r]} ({countVal})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── HIGH-CRAFT CONTACTS TABLE ─────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] shadow-sm">
        <div className="setu-scroll-x overflow-x-auto">
          <table className="w-full text-left text-xs" style={{ minWidth: 920 }}>
            <thead>
              <tr className="border-b border-[var(--setu-line)] bg-[var(--setu-well)] text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
                <th className="py-3.5 pl-5 pr-4">Contact Person</th>
                <th className="py-3.5 px-4">Company</th>
                <th className="py-3.5 px-4">Relationship</th>
                <th className="py-3.5 px-4">Direct Contact</th>
                <th className="py-3.5 px-4">Deals</th>
                <th className="py-3.5 px-4">Assigned Rep</th>
                <th className="py-3.5 px-4">Last Touch</th>
                <th className="py-3.5 pr-5 pl-2 text-right">Reach Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--setu-line)]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--setu-well)] text-[var(--setu-text-3)]">
                        <ContactIcon className="h-6 w-6" />
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-[var(--setu-text)]">
                        {contacts.length === 0 ? "No contacts discovered yet" : "No contacts match current filters"}
                      </h3>
                      <p className="text-xs text-[var(--setu-text-3)]">
                        {contacts.length === 0
                          ? "Contacts are automatically indexed as you add decision makers and meeting attendees to leads."
                          : "Try clearing your search query or relationship filter to see more contacts."}
                      </p>
                      {filtered && (
                        <SetuButton
                          size="sm"
                          onClick={clearAllFilters}
                          className="mt-2"
                        >
                          <RotateCcw />
                          <span>Clear all filters</span>
                        </SetuButton>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((c) => {
                  const cfg = RELATIONSHIP_CONFIG[c.relationship];
                  return (
                    <tr
                      key={c.key}
                      onClick={() => router.push(ROUTES.setuDeal(c.primaryDealId))}
                      className="group cursor-pointer transition-colors hover:bg-[var(--setu-soft)]/60"
                      title="Click to open primary deal"
                    >
                      {/* Contact Person */}
                      <td className="py-3.5 pl-5 pr-4">
                        <div className="flex items-center gap-3">
                          <SetuAvatar name={c.name} size="md" />
                          <div className="min-w-0">
                            <span className="block truncate font-semibold text-[var(--setu-text)] group-hover:text-[var(--setu-accent)]">
                              {c.name}
                            </span>
                            <span className="block truncate text-[11px] text-[var(--setu-text-3)]">
                              {c.role || "Decision Maker"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-[var(--setu-text)]">
                          <Building2 className="h-3.5 w-3.5 text-[var(--setu-text-3)] shrink-0" />
                          <span className="truncate">{c.company}</span>
                        </div>
                      </td>

                      {/* Relationship Pill */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                            cfg.badge
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
                          {cfg.label}
                        </span>
                      </td>

                      {/* Direct Contact */}
                      <td className="py-3.5 px-4 text-xs" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-1">
                          {c.phone ? (
                            <a
                              href={`tel:+${phoneDigits(c.phone)}`}
                              className="inline-flex items-center gap-1.5 text-xs text-[var(--setu-accent)] hover:underline"
                              title="Call contact"
                            >
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="tabular-nums">{c.phone}</span>
                            </a>
                          ) : null}
                          {c.email ? (
                            <a
                              href={`mailto:${c.email}`}
                              className="inline-flex items-center gap-1.5 text-xs text-[var(--setu-text-2)] hover:text-[var(--setu-text)] hover:underline"
                              title="Send email"
                            >
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[160px]">{c.email}</span>
                            </a>
                          ) : null}
                          {!c.phone && !c.email && <span className="text-[11px] text-[var(--setu-text-3)]">—</span>}
                        </div>
                      </td>

                      {/* Deals Count */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 rounded-md border border-[var(--setu-line)] bg-[var(--setu-well)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--setu-text)]">
                          <Handshake className="h-3 w-3 text-[var(--setu-text-3)]" />
                          {c.dealIds.length} {c.dealIds.length === 1 ? "Deal" : "Deals"}
                        </span>
                      </td>

                      {/* Assigned Rep */}
                      <td className="py-3.5 px-4 text-xs text-[var(--setu-text-2)] whitespace-nowrap">
                        {c.ownerNames.length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <SetuAvatar name={c.ownerNames[0]} size="xs" />
                            <span className="font-medium text-[var(--setu-text)]">{c.ownerNames[0]}</span>
                            {c.ownerNames.length > 1 && (
                              <span className="rounded-full bg-[var(--setu-well)] px-1.5 py-0.2 text-[10px] text-[var(--setu-text-3)]">
                                +{c.ownerNames.length - 1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--setu-text-3)]">—</span>
                        )}
                      </td>

                      {/* Last Touch */}
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap text-[var(--setu-text-2)]">
                        {relativeDay(c.lastTouch, today) ?? formatDate(c.lastTouch)}
                      </td>

                      {/* Reach Out Action Buttons */}
                      <td className="py-3.5 pr-5 pl-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {c.phone && (
                            <a
                              href={`tel:+${phoneDigits(c.phone)}`}
                              aria-label={`Call ${c.name}`}
                              title={`Call ${c.name}`}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--setu-line)] bg-[var(--setu-well)] text-[var(--setu-text-2)] transition-all hover:border-[var(--setu-accent)] hover:bg-[var(--setu-soft)] hover:text-[var(--setu-accent)]"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {c.email && (
                            <a
                              href={`mailto:${c.email}`}
                              aria-label={`Email ${c.name}`}
                              title={`Email ${c.name}`}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--setu-line)] bg-[var(--setu-well)] text-[var(--setu-text-2)] transition-all hover:border-[var(--setu-accent)] hover:bg-[var(--setu-soft)] hover:text-[var(--setu-accent)]"
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {c.phone && (
                            <a
                              href={`https://wa.me/${phoneDigits(c.phone)}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`WhatsApp ${c.name}`}
                              title={`WhatsApp ${c.name}`}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--setu-line)] bg-[var(--setu-well)] text-[var(--setu-text-2)] transition-all hover:border-[var(--setu-accent-ring)] hover:bg-[var(--setu-accent-soft)] hover:text-[var(--setu-accent)]"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <Link
                            href={ROUTES.setuDeal(c.primaryDealId)}
                            aria-label={`Open deal for ${c.name}`}
                            title={`Open primary deal`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--setu-line)] bg-[var(--setu-well)] text-[var(--setu-text-2)] transition-all hover:border-[var(--setu-accent)] hover:bg-[var(--setu-soft)] hover:text-[var(--setu-accent)]"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SetuPage>
  );
}
