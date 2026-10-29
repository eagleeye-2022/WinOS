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
import { EmptyState, FilterChips, Pill, SearchInput, SetuAvatar, SetuButton, SetuPage, SourceBadge, StageBadge } from "./setu-ui";

type ContactFilter = "all" | "members" | "prospects" | "won" | "lost";
const FILTERS: readonly ContactFilter[] = ["all", "members", "prospects", "won", "lost"];
const FILTER_LABEL: Record<ContactFilter, string> = { all: "All", members: "BNI Members", prospects: "Prospects", won: "Won", lost: "Lost" };

const MATCH: Record<ContactFilter, (c: SetuContact) => boolean> = {
  all: () => true,
  members: (c) => c.kind === "MEMBER",
  prospects: (c) => c.kind === "PROSPECT" && c.stage !== "WON" && c.stage !== "LOST",
  won: (c) => c.stage === "WON",
  lost: (c) => c.stage === "LOST",
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
    <SetuPage
      icon={Contact}
      title="Contacts"
      description="Everyone in your BNI network — chapter members you've met and the prospects they sent your way."
      actions={
        <>
          <SetuButton onClick={() => toast.info("vCard import will be available with the backend")}>
            <Upload /> Import vCard
          </SetuButton>
          <SetuButton variant="primary" onClick={() => setAdding(true)}>
            <Plus /> Add Prospect
          </SetuButton>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search by name, business, phone…" />
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({ value: f, label: FILTER_LABEL[f], count: contacts.filter(MATCH[f]).length }))}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Contact} text="No contacts match these filters." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visible.map((c) => (
            <Link key={c.id} href={c.href} className="setu-card setu-card-hover flex flex-col items-center p-6 text-center">
              <span className="setu-tile p-1.5">
                <SetuAvatar name={c.name} size="lg" />
              </span>
              <div className="mt-4 w-full truncate text-[15px] font-semibold tracking-tight">{c.name}</div>
              <div className="setu-text-3 w-full truncate text-xs">{c.business || c.connectedVia || "—"}</div>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {c.kind === "MEMBER" ? <Pill dot="bg-pink-500">BNI Member</Pill> : c.stage && <StageBadge stage={c.stage} />}
                {c.refsReceived ? <Pill dot="bg-green-500">{c.refsReceived} refs</Pill> : null}
              </div>
              <div className="mt-auto w-full pt-5">
                <div className="setu-text-2 flex items-center justify-between gap-2 border-t border-[var(--setu-line)] pt-3 text-xs">
                  <span className="flex items-center gap-1">
                    <Phone size={11} /> {c.phone || "—"}
                  </span>
                  {c.source && <SourceBadge source={c.source} />}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <AddProspectDialog stage={adding ? "PROSPECT" : null} onClose={() => setAdding(false)} />
    </SetuPage>
  );
}
