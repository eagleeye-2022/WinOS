"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Contact, Download, Handshake, Mail, MessageCircle, Phone, UserRoundSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { useSetuStore } from "../../provider";
import { formatDateTime, isoDate, phoneDigits } from "../../utils";
import { RELATIONSHIP_LABEL, buildContacts, downloadCsv, matchesText, toCsv, type Relationship } from "../../insights";
import { FilterDropdown, SetuAvatar, SetuButton, SetuPage } from "../setu-ui";
import { ClearButton, EmptyRow, ListHeader, ListTable, SearchBox, StatTile } from "./list-ui";

const RELATIONSHIPS: readonly (Relationship | "all")[] = ["all", "CUSTOMER", "ACTIVE_DEAL", "LEAD", "LOST"];
const RELATIONSHIP_TONE: Record<Relationship, string> = {
  CUSTOMER: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  ACTIVE_DEAL: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
  LEAD: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  LOST: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

/** Setu → Contacts: client-side people (decision makers + external meeting attendees). */
export function ContactsPage() {
  const router = useRouter();
  const deals = useSetuStore((s) => s.deals);
  const meetings = useSetuStore((s) => s.meetings);
  const [q, setQ] = useUrlState("q", "");
  const [rel, setRel] = useUrlState<Relationship | "all">("type", "all", { allowed: RELATIONSHIPS });
  const [owner, setOwner] = useUrlState("owner", "");

  const contacts = useMemo(() => buildContacts(deals, meetings), [deals, meetings]);
  const owners = [...new Set(contacts.flatMap((c) => c.ownerNames))].sort();
  const count = (r: Relationship) => contacts.filter((c) => c.relationship === r).length;
  const rows = contacts.filter((c) => (rel === "all" || c.relationship === rel) && (!owner || c.ownerNames.includes(owner)) && matchesText(q, c.name, c.company, c.email, c.phone, c.role));
  const filtered = q !== "" || rel !== "all" || owner !== "";

  const exportCsv = () => {
    if (!rows.length) return toast.info("No contacts to export");
    downloadCsv(
      `setu-contacts-${isoDate(new Date())}.csv`,
      toCsv([["Name", "Role", "Company", "Email", "Phone", "Relationship", "Deals", "Owners", "Last Touch"], ...rows.map((c) => [c.name, c.role, c.company, c.email, c.phone, RELATIONSHIP_LABEL[c.relationship], c.dealIds.length, c.ownerNames.join("; "), formatDateTime(c.lastTouch)])])
    );
  };

  return (
    <SetuPage>
      <ListHeader
        crumbs={[{ label: "Sales" }, { label: "Contacts" }]}
        title="Contacts"
        subtitle="Decision makers and client attendees across every lead and deal."
        actions={
          <SetuButton onClick={exportCsv} disabled={rows.length === 0}>
            <Download /> Export
          </SetuButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Contact} label="All Contacts" value={String(contacts.length)} hint="Unique people" />
        <StatTile icon={BadgeCheck} label="Customers" value={String(count("CUSTOMER"))} hint="On a closed-won deal" tone="bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-300" />
        <StatTile icon={Handshake} label="Active Deals" value={String(count("ACTIVE_DEAL"))} hint="In Proposal / Negotiation" tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300" />
        <StatTile icon={UserRoundSearch} label="Leads" value={String(count("LEAD"))} hint="Before a proposal" tone="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" />
      </div>

      <div className="setu-card flex flex-wrap items-center gap-2 p-2.5">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, company, email, phone…" />
        <FilterDropdown
          label="Relationship"
          value={rel}
          onChange={(v) => setRel(v as Relationship | "all")}
          options={RELATIONSHIPS.map((r) => ({ value: r, label: r === "all" ? "All" : RELATIONSHIP_LABEL[r] }))}
          className="h-9"
        />
        <FilterDropdown label="Owner" value={owner} onChange={setOwner} options={[{ value: "", label: "All Reps" }, ...owners.map((o) => ({ value: o, label: o }))]} className="h-9" />
        <ClearButton
          disabled={!filtered}
          onClick={() => {
            setQ("");
            setRel("all");
            setOwner("");
          }}
        />
      </div>

      <p className="setu-text-2 text-xs">
        Showing <span className="font-semibold text-[var(--setu-text)]">{rows.length}</span> of {contacts.length} contacts
      </p>

      <ListTable head={["Contact", "Company", "Relationship", "Email / Phone", "Deals", "Owner", "Last Touch", "Reach Out"]}>
        {rows.length === 0 ? (
          <EmptyRow colSpan={8} text={contacts.length === 0 ? "No contacts yet — they appear as you add leads and meetings." : "No contacts match these filters."} />
        ) : (
          rows.map((c) => (
            <tr key={c.key} onClick={() => router.push(ROUTES.setuDeal(c.primaryDealId))} className="cursor-pointer hover:bg-[var(--setu-soft)]/60" title="Open their main deal">
              <td className="px-4 py-3">
                <span className="flex items-center gap-2.5">
                  <SetuAvatar name={c.name} size="md" />
                  <span>
                    <span className="block font-semibold">{c.name}</span>
                    {c.role && <span className="setu-text-3 block text-xs">{c.role}</span>}
                  </span>
                </span>
              </td>
              <td className="px-4 py-3 font-medium">{c.company}</td>
              <td className="px-4 py-3">
                <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", RELATIONSHIP_TONE[c.relationship])}>{RELATIONSHIP_LABEL[c.relationship]}</span>
              </td>
              <td className="px-4 py-3 text-xs">
                {c.email && <p className="setu-text-2">{c.email}</p>}
                {c.phone && <p className="setu-text-3">{c.phone}</p>}
                {!c.email && !c.phone && <span className="setu-text-3">—</span>}
              </td>
              <td className="px-4 py-3 text-xs tabular-nums">{c.dealIds.length}</td>
              <td className="setu-text-2 px-4 py-3 text-xs">
                {c.ownerNames.length > 0 && (
                  <span className="flex items-center gap-2">
                    <SetuAvatar name={c.ownerNames[0]} size="xs" />
                    {c.ownerNames[0]}
                    {c.ownerNames.length > 1 && ` +${c.ownerNames.length - 1}`}
                  </span>
                )}
              </td>
              <td className="setu-text-2 whitespace-nowrap px-4 py-3 text-xs">{formatDateTime(c.lastTouch)}</td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <span className="flex items-center gap-1">
                  {c.phone && (
                    <ReachOut href={`tel:+${phoneDigits(c.phone)}`} label={`Call ${c.name}`}>
                      <Phone size={14} />
                    </ReachOut>
                  )}
                  {c.email && (
                    <ReachOut href={`mailto:${c.email}`} label={`Email ${c.name}`}>
                      <Mail size={14} />
                    </ReachOut>
                  )}
                  {c.phone && (
                    <ReachOut href={`https://wa.me/${phoneDigits(c.phone)}`} label={`WhatsApp ${c.name}`} external>
                      <MessageCircle size={14} />
                    </ReachOut>
                  )}
                </span>
              </td>
            </tr>
          ))
        )}
      </ListTable>
    </SetuPage>
  );
}

function ReachOut({ href, label, external, children }: { href: string; label: string; external?: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="setu-text-2 flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--setu-soft)] hover:text-[var(--setu-accent)]"
    >
      {children}
    </a>
  );
}
