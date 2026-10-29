"use client";

import { useState } from "react";
import Link from "next/link";
import { Contact, Phone, Plus, Upload } from "lucide-react";
import { toast } from "@/components/shared/toast";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { useSetuStore } from "../store";
import type { SetuContact } from "../types";
import { buildContacts } from "../utils";
import { AddProspectDialog } from "./pipeline/prospect-dialogs";
import { EmptyState, FilterChips, Pill, SearchInput, SetuAvatar, SetuButton, SetuSection, SourceBadge, StageBadge } from "./setu-ui";

type ContactFilter = "all" | "prospects" | "members" | "referrals" | "won";
const FILTERS: readonly ContactFilter[] = ["all", "prospects", "members", "referrals", "won"];
const FILTER_LABEL: Record<ContactFilter, string> = {
  all: "All",
  prospects: "Prospects",
  members: "Members",
  referrals: "Referrals",
  won: "Won",
};

const MATCH: Record<ContactFilter, (c: SetuContact) => boolean> = {
  all: () => true,
  prospects: (c) => c.kind === "PROSPECT",
  members: (c) => c.kind === "MEMBER",
  // Prospects that came in as a referral from a 121 meeting.
  referrals: (c) => c.source === "MEETING_121",
  won: (c) => c.stage === "WON",
};

export function ContactsWorkspace() {
  const meetings = useSetuStore((s) => s.meetings);
  const prospects = useSetuStore((s) => s.prospects);
  const [q, setQ] = useUrlState("q", "");
  const [filter, setFilter] = useUrlState<ContactFilter>("filter", "all", { allowed: FILTERS });
  const [adding, setAdding] = useState(false);

  const contacts = buildContacts(meetings, prospects);
  const needle = q.trim().toLowerCase();
  const visible = contacts
    .filter(MATCH[filter])
    .filter((c) => !needle || `${c.name} ${c.business} ${c.phone} ${c.connectedVia}`.toLowerCase().includes(needle));

  return (
    <SetuSection
      title="BNI Contacts"
      actions={
        <>
          <SetuButton onClick={() => toast.info("vCard import will be available with the backend")}>
            <Upload /> Import vCard
          </SetuButton>
          <SetuButton variant="primary" onClick={() => setAdding(true)}>
            <Plus /> Add Contact
          </SetuButton>
        </>
      }
    >
      <SearchInput value={q} onChange={setQ} placeholder="Search by name, business, phone…" />
      <FilterChips
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({ value: f, label: FILTER_LABEL[f], count: contacts.filter(MATCH[f]).length }))}
      />

      {visible.length === 0 ? (
        <EmptyState icon={Contact} text="No contacts match these filters." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {visible.map((c) => (
            <Link key={c.id} href={c.href} className="setu-card setu-card-hover flex flex-col rounded-2xl p-5">
              <SetuAvatar name={c.name} />
              <div className="mt-3 truncate text-sm font-semibold tracking-tight">{c.name}</div>
              <div className="setu-text-2 truncate text-xs">{c.business || c.connectedVia || "—"}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.kind === "MEMBER" ? <Pill dot="bg-pink-500">BNI Member</Pill> : c.stage && <StageBadge stage={c.stage} />}
                {c.refsReceived ? <Pill dot="bg-green-500">{c.refsReceived} refs</Pill> : null}
                {c.source === "WHATSAPP_BOT" && <SourceBadge source={c.source} label="Via Bot" />}
              </div>
              <div className="setu-text-3 mt-auto flex items-center gap-1 pt-3 text-xs">
                <Phone size={11} /> {c.phone || "—"}
              </div>
            </Link>
          ))}
        </div>
      )}

      <AddProspectDialog stage={adding ? "PROSPECT" : null} onClose={() => setAdding(false)} />
    </SetuSection>
  );
}
