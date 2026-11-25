"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BadgeCheck, ChevronDown, Contact, FileUp, LayoutGrid, Link2, MessageCircle, Phone, Plus, UserPlus, UserRoundPlus, UserRoundSearch, Users } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePageViewState, useUrlState } from "@/lib/navigation/use-url-state";
import { BNI_STAGE_BY_ID, buildContacts, matchesContactFilter, parseVCards, type BniContact, type ContactFilter, type PersonInput } from "../../bni";
import { useBni } from "../../bni-client";
import { downloadCsv, matchesText, toCsv } from "../../insights";
import { useSetuStore } from "../../provider";
import { formatDate, isoDate, phoneDigits } from "../../utils";
import { SetuAvatar, SetuButton } from "../setu-ui";
import { BniDialog, Segmented } from "./bni-dialog";
import { MemberFormDialog, ProspectDialog } from "./bni-forms";
import { MemberDialog } from "./member-dialog";
import { ChipPill, ClearFilters, DataTable, FilterPanel, PanelSearch, SetuShell, StageTag, TAG_TONE, Tag } from "./setu-shell";

const FILTERS: ContactFilter[] = ["all", "prospects", "members", "referrals", "won"];
const FILTER_META: Record<ContactFilter, { label: string; icon: React.ElementType }> = {
  all: { label: "All", icon: LayoutGrid },
  prospects: { label: "Prospects", icon: UserRoundSearch },
  members: { label: "Members", icon: Users },
  referrals: { label: "Referrals", icon: Link2 },
  won: { label: "Won", icon: BadgeCheck },
};

/** Setu → Contacts: every BNI member and prospect; members open their 121 record, prospects their workspace. */
export function ContactsView() {
  const router = useRouter();
  const deals = useSetuStore((s) => s.deals);
  const notes = useSetuStore((s) => s.notes);
  const [q, setQ] = useUrlState("q", "");
  const [filter, setFilter] = useUrlState<ContactFilter>("show", "all", { allowed: FILTERS });
  const [openMember, setOpenMember] = usePageViewState<string | null>("SetuContacts:member", null);
  const [adding, setAdding] = usePageViewState<"member" | "prospect" | null>("SetuContacts:add", null);
  const [imported, setImported] = useState<PersonInput[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const contacts = useMemo(() => buildContacts(deals, notes), [deals, notes]);
  const rows = contacts.filter((c) => matchesContactFilter(c, filter) && matchesText(q, c.name, c.business, c.phone, c.email));
  const members = contacts.filter((c) => c.kind === "MEMBER").length;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const people = parseVCards(await file.text());
    if (fileRef.current) fileRef.current.value = "";
    if (!people.length) return toast.error("No contacts found in that file.");
    setImported(people);
  };

  const exportCsv = () => {
    if (!rows.length) return toast.info("No contacts to export");
    downloadCsv(
      `setu-contacts-${isoDate(new Date())}.csv`,
      toCsv([
        ["Name", "Type", "Business", "Phone", "Email", "Stage"],
        ...rows.map((c) => [c.name, c.kind === "MEMBER" ? "BNI Member" : "Prospect", c.business, c.phone, c.email, c.stage ? BNI_STAGE_BY_ID[c.stage].label : ""]),
      ])
    );
  };

  const open = (c: BniContact) => (c.kind === "MEMBER" ? setOpenMember(c.deal.id) : router.push(ROUTES.setuDeal(c.deal.id)));

  return (
    <SetuShell
      tab="contacts"
      title="BNI Contacts"
      actions={
        <>
          <input ref={fileRef} type="file" accept=".vcf,text/vcard,text/x-vcard" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <SetuButton variant="muted" onClick={() => fileRef.current?.click()}>
            <FileUp /> Import vCard
          </SetuButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SetuButton variant="solid">
                <Plus /> Add Contact <ChevronDown />
              </SetuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onSelect={() => setAdding("member")}>
                <UserPlus size={14} /> BNI Member
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAdding("prospect")}>
                <UserRoundPlus size={14} /> Prospect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      <FilterPanel
        chips={FILTERS.map((f) => (
          <ChipPill key={f} active={filter === f} onClick={() => setFilter(f)} icon={FILTER_META[f].icon} label={FILTER_META[f].label} count={contacts.filter((c) => matchesContactFilter(c, f)).length} />
        ))}
      >
        <PanelSearch value={q} onChange={setQ} placeholder="Search by name, business, phone, email…" />
        <ClearFilters
          show={Boolean(q) || filter !== "all"}
          onClick={() => {
            setQ("");
            setFilter("all");
          }}
        />
      </FilterPanel>

      <section className="setu-card overflow-hidden p-4">
        {/* Summary strip */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--setu-accent-soft)] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--setu-card)] text-[var(--setu-accent)] shadow-sm">
              <Contact size={16} />
            </span>
            <div>
              <p className="setu-text-2 text-xs">Directory</p>
              <p className="text-sm font-medium tabular-nums">
                <span>{contacts.length - members} prospects</span> • <span>{members} members</span> •{" "}
                <span className="text-[var(--setu-text-2)]">{rows.length} shown</span>
              </p>
            </div>
          </div>
          <SetuButton size="sm" onClick={exportCsv}>
            Export CSV
          </SetuButton>
        </div>

        <DataTable head={["Contact", "Type", "Business", "Phone", "Stage & Tags", "Actions"]}>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-14 text-center">
                <p className="text-sm font-medium">{contacts.length ? "No contacts match" : "No contacts yet"}</p>
              </td>
            </tr>
          ) : (
            rows.map((c) => <ContactRow key={c.deal.id} c={c} onOpen={() => open(c)} />)
          )}
        </DataTable>
      </section>

      <MemberDialog memberId={openMember} onClose={() => setOpenMember(null)} />
      <MemberFormDialog open={adding === "member"} onClose={() => setAdding(null)} onSaved={(m) => setOpenMember(m.id)} />
      <ProspectDialog open={adding === "prospect"} onClose={() => setAdding(null)} preset={{ stage: "PROSPECT" }} />
      <VCardImportDialog people={imported} onClose={() => setImported(null)} />
    </SetuShell>
  );
}

function ContactRow({ c, onOpen }: { c: BniContact; onOpen: () => void }) {
  return (
    <tr onClick={onOpen} className="group cursor-pointer transition-colors hover:bg-[var(--setu-well)]/60">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <SetuAvatar name={c.name} size="md" />
          <div className="min-w-0">
            <p className="truncate font-medium group-hover:text-[var(--setu-accent)]">{c.name}</p>
            <p className="setu-text-2 truncate text-[11px]">{c.email || `Updated ${formatDate(c.deal.updatedAt)}`}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        {c.kind === "MEMBER" ? <Tag className={TAG_TONE.neutral}>BNI Member</Tag> : <Tag className={TAG_TONE.blue}>Prospect</Tag>}
      </td>
      <td className="px-4 py-3.5 text-[13px]">{c.business || <span className="setu-text-3">—</span>}</td>
      <td className="px-4 py-3.5 text-[13px] tabular-nums" onClick={(e) => e.stopPropagation()}>
        {c.phone ? (
          <a href={`tel:+${phoneDigits(c.phone)}`} className="inline-flex items-center gap-1.5 text-[var(--setu-accent)] hover:underline">
            <Phone size={12} /> {c.phone}
          </a>
        ) : (
          <span className="setu-text-3">—</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1">
          {c.stage && <StageTag stage={c.stage} />}
          {c.deal.bni?.origin === "BOT" && <Tag className={TAG_TONE.neutral}>Via bot</Tag>}
          {c.kind === "PROSPECT" && c.fromReferral && <Tag className={TAG_TONE.neutral}>Referral</Tag>}
          {c.refsReceived > 0 && <Tag className={TAG_TONE.neutral}>{c.refsReceived} refs</Tag>}
          {c.followUp && <Tag className={TAG_TONE.amber}>Follow up</Tag>}
        </div>
      </td>
      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1.5">
          {c.phone && (
            <a
              href={`https://wa.me/${phoneDigits(c.phone)}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`WhatsApp ${c.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400"
            >
              <MessageCircle size={14} />
            </a>
          )}
          <button type="button" onClick={onOpen} className="inline-flex h-8 items-center gap-1 rounded-lg bg-[var(--setu-solid)] px-3 text-xs font-medium text-[var(--setu-solid-ink)] transition-colors hover:bg-[var(--setu-solid-hover)]">
            {c.kind === "MEMBER" ? "121 Record" : "Open"} <ArrowUpRight size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}

/** Pick which of the vCard's contacts to add, as members or prospects. */
function VCardImportDialog({ people, onClose }: { people: PersonInput[] | null; onClose: () => void }) {
  const bni = useBni();
  const [as, setAs] = useState<"PROSPECT" | "MEMBER">("PROSPECT");
  const [off, setOff] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const list = people ?? [];
  const chosen = list.filter((_, i) => !off.has(i));

  const run = async () => {
    setBusy(true);
    let done = 0;
    const failed: string[] = [];
    for (const p of chosen) {
      try {
        await (as === "MEMBER" ? bni.createMember(p) : bni.createProspect({ ...p, kind: "PROSPECT", origin: "DIRECT", stage: "PROSPECT", remark: "", need: "" }));
        done++;
      } catch (err) {
        failed.push(`${p.name || p.phone}: ${(err as Error).message}`);
      }
    }
    setBusy(false);
    if (done) toast.success(`Imported ${done} contact${done === 1 ? "" : "s"}`);
    if (failed.length) toast.error(`${failed.length} not imported — ${failed[0]}`);
    setOff(new Set());
    onClose();
  };

  return (
    <BniDialog
      open={people !== null}
      onClose={onClose}
      title="Import vCard"
      description={`${list.length} contact${list.length === 1 ? "" : "s"} found`}
      footer={
        <>
          <SetuButton variant="muted" onClick={onClose}>
            Cancel
          </SetuButton>
          <SetuButton variant="solid" onClick={run} disabled={busy || !chosen.length}>
            {busy ? "Importing…" : `Import ${chosen.length}`}
          </SetuButton>
        </>
      }
    >
      <div className="space-y-3 px-6 py-5">
        <div className="flex items-center gap-2 text-xs">
          <span className="setu-text-2 font-medium">Add as</span>
          <Segmented
            value={as}
            onChange={setAs}
            options={[
              { value: "PROSPECT", label: "Prospects" },
              { value: "MEMBER", label: "BNI Members" },
            ]}
          />
        </div>
        <ul className="space-y-2">
          {list.map((p, i) => (
            <li key={i} className="flex items-center gap-3 rounded-lg bg-[var(--setu-well)] px-3 py-2.5 text-xs">
              <Checkbox
                checked={!off.has(i)}
                onCheckedChange={(c) =>
                  setOff((s) => {
                    const n = new Set(s);
                    if (c === true) n.delete(i);
                    else n.add(i);
                    return n;
                  })
                }
                aria-label={p.name}
              />
              <SetuAvatar name={p.name || "?"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.name || "(no name)"}</span>
                <span className="setu-text-2 block truncate">{[p.business, p.phone, p.email].filter(Boolean).join(" · ")}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </BniDialog>
  );
}
