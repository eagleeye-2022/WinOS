"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CheckCheck, Clock3, LayoutGrid, Link2, Plus, Trash2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { usePageViewState, useUrlState } from "@/lib/navigation/use-url-state";
import { BNI_STAGE_BY_ID, bniStageOf, buildReferrals, type ReferralRow } from "../../bni";
import { useBni } from "../../bni-client";
import { matchesText } from "../../insights";
import { useSetuStore } from "../../provider";
import { formatDate } from "../../utils";
import { SetuAvatar, SetuButton, attempt } from "../setu-ui";
import { ConvertRefsDialog, ReferralDialog } from "./bni-referral-dialogs";
import { MemberDialog } from "./member-dialog";
import { ChipPill, ClearFilters, FilterPanel, PanelSearch, SectionCard, SetuShell, TAG_TONE, Tag } from "./setu-shell";

type Filter = "all" | "received" | "given" | "pending";
const FILTERS: Filter[] = ["all", "received", "given", "pending"];
const META: Record<Filter, { label: string; icon: React.ElementType }> = {
  all: { label: "All", icon: LayoutGrid },
  received: { label: "Received", icon: ArrowDownLeft },
  given: { label: "Given", icon: ArrowUpRight },
  pending: { label: "Pending conversion", icon: Clock3 },
};
const matches = (r: ReferralRow, f: Filter) => (f === "received" ? r.direction === "RECEIVED" : f === "given" ? r.direction === "GIVEN" : f === "pending" ? r.status === "PENDING" : true);

/** Setu → Referrals: every referral received and given, and which ones reached the pipeline. */
export function ReferralsView() {
  const deals = useSetuStore((s) => s.deals);
  const notes = useSetuStore((s) => s.notes);
  const bni = useBni();
  const [q, setQ] = useUrlState("q", "");
  const [filter, setFilter] = useUrlState<Filter>("show", "all", { allowed: FILTERS });
  const [logOpen, setLogOpen] = usePageViewState("SetuReferrals:log", false);
  const [member, setMember] = usePageViewState<string | null>("SetuReferrals:member", null);
  const [convertFor, setConvertFor] = usePageViewState<string | null>("SetuReferrals:convert", null);

  const all = useMemo(() => buildReferrals(deals, notes), [deals, notes]);
  const rows = all.filter((r) => matches(r, filter) && matchesText(q, r.memberName, r.details.name, r.details.business, r.details.phone));

  // Top referrers: members by referrals received.
  const top = useMemo(() => {
    const m = new Map<string, { name: string; id?: string; received: number; given: number }>();
    for (const r of all) {
      const key = r.memberId ?? `name:${r.memberName.toLowerCase()}`;
      const cur = m.get(key) ?? { name: r.memberName, id: r.memberId, received: 0, given: 0 };
      if (r.direction === "RECEIVED") cur.received++;
      else cur.given++;
      m.set(key, cur);
    }
    return [...m.values()].sort((a, b) => b.received - a.received || b.given - a.given).slice(0, 4);
  }, [all]);

  const convertMember = deals.find((d) => d.id === convertFor);

  return (
    <SetuShell
      tab="referrals"
      title="Referrals Tracker"
      subtitle="Referrals received from and given to chapter members — and which reached the pipeline."
      actions={
        <SetuButton variant="solid" onClick={() => setLogOpen(true)}>
          <Plus /> Log Referral
        </SetuButton>
      }
    >
      {top.length > 0 && (
        <SectionCard icon={Trophy} title="Top Referrers" description="Members who sent you the most referrals." badge="Chapter">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {top.map((t, i) => (
              <button
                key={t.id ?? t.name}
                type="button"
                disabled={!t.id}
                onClick={() => t.id && setMember(t.id)}
                className="flex items-center gap-3 rounded-xl bg-[var(--setu-well)] p-3 text-left transition-colors enabled:hover:bg-[var(--setu-accent-soft)] disabled:cursor-default"
              >
                <span className="relative">
                  <SetuAvatar name={t.name} size="md" className="h-10 w-10 text-sm" />
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#1d4ed8] text-[9px] font-bold text-white">{i + 1}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{t.name}</span>
                  <span className="setu-text-2 block text-[11px]">
                    <span className="font-semibold text-green-600 dark:text-green-400">{t.received}</span> received • <span className="font-semibold text-blue-600 dark:text-blue-400">{t.given}</span> given
                  </span>
                </span>
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      <FilterPanel
        chips={FILTERS.map((f) => (
          <ChipPill key={f} active={filter === f} onClick={() => setFilter(f)} icon={META[f].icon} label={META[f].label} count={all.filter((r) => matches(r, f)).length} />
        ))}
      >
        <PanelSearch value={q} onChange={setQ} placeholder="Search member, referral, business, phone…" />
        <ClearFilters
          show={Boolean(q) || filter !== "all"}
          onClick={() => {
            setQ("");
            setFilter("all");
          }}
        />
      </FilterPanel>

      <SectionCard
        icon={Link2}
        title="Referral Log"
        description={`${rows.length} of ${all.length} referrals`}
        action={<span className="rounded-full bg-[var(--setu-well)] px-2.5 py-0.5 text-[11px] font-semibold">{all.filter((r) => r.status === "CONVERTED").length} Converted</span>}
      >
        {rows.length === 0 ? (
          <div className="rounded-xl bg-[var(--setu-well)] px-6 py-12 text-center">
            <p className="text-sm font-semibold">{all.length ? "No referrals match" : "No referrals yet"}</p>
            <p className="setu-text-2 mt-1 text-xs">{all.length ? "Try another filter or search." : "Log a 121 with referrals, or log one here."}</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--setu-well)] px-4 py-3">
                <SetuAvatar name={r.direction === "GIVEN" ? r.memberName : r.details.name} size="md" className="h-10 w-10 text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">
                      {r.direction === "GIVEN" ? (
                        <>
                          You → <MemberLink r={r} onOpen={setMember} />
                        </>
                      ) : (
                        <>
                          <MemberLink r={r} onOpen={setMember} /> → {r.details.name}
                        </>
                      )}
                    </p>
                    <Tag className={r.direction === "GIVEN" ? TAG_TONE.orange : TAG_TONE.blue}>{r.direction === "GIVEN" ? "Given" : "Received"}</Tag>
                  </div>
                  <p className="setu-text-2 mt-0.5 text-xs">
                    {[r.direction === "GIVEN" ? r.details.business || "Referral given" : r.details.business, r.details.phone, r.details.via ? `Co ${r.details.via}` : "", formatDate(r.at)].filter(Boolean).join(" • ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.status === "PENDING" && (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        <Clock3 size={12} /> Pending
                      </span>
                      {r.memberId && (
                        <SetuButton size="sm" variant="solid" onClick={() => setConvertFor(r.memberId ?? null)}>
                          <ArrowRight /> Convert
                        </SetuButton>
                      )}
                    </>
                  )}
                  {r.status === "GIVEN" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--setu-card)] px-2.5 py-1 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                      <ArrowUpRight size={12} /> Given
                    </span>
                  )}
                  {r.status === "CONVERTED" && r.prospect && (
                    <Link href={ROUTES.setuDeal(r.prospect.id)} className="inline-flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--setu-card)] px-2.5 py-1 text-[11px] font-semibold text-green-700 dark:text-green-400">
                        <CheckCheck size={12} /> Received
                      </span>
                      <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", BNI_STAGE_BY_ID[bniStageOf(r.prospect)].pill)}>{BNI_STAGE_BY_ID[bniStageOf(r.prospect)].label}</span>
                    </Link>
                  )}
                  {r.noteId && (
                    <button
                      type="button"
                      onClick={() => void attempt(bni.deleteBniNote(r.noteId as string), "Referral removed")}
                      aria-label="Remove referral"
                      title={r.prospect ? "Remove this referral record (the prospect stays on the pipeline)" : "Remove referral"}
                      className="setu-text-3 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[var(--setu-card)] hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <ReferralDialog open={logOpen} onClose={() => setLogOpen(false)} />
      <MemberDialog memberId={member} onClose={() => setMember(null)} />
      <ConvertRefsDialog open={Boolean(convertMember)} onClose={() => setConvertFor(null)} member={convertMember} />
    </SetuShell>
  );
}

function MemberLink({ r, onOpen }: { r: ReferralRow; onOpen: (id: string) => void }) {
  if (!r.memberId) return <span>{r.memberName}</span>;
  return (
    <button type="button" onClick={() => onOpen(r.memberId as string)} className="font-semibold hover:text-[var(--setu-accent)] hover:underline">
      {r.memberName}
    </button>
  );
}
