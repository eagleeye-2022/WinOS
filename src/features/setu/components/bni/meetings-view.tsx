"use client";

import { useMemo } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Download, GripVertical, LayoutGrid, Link2, ListChecks, Phone, Plus, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/toast";
import { usePageViewState, useUrlState } from "@/lib/navigation/use-url-state";
import { BNI_STAGES, BNI_STAGE_BY_ID, bniStageOf, memberSummaries, type MemberSummary } from "../../bni";
import { downloadCsv, matchesText, toCsv } from "../../insights";
import { useSetuStore } from "../../provider";
import { formatDate, formatDateTime, isoDate, phoneDigits } from "../../utils";
import { SetuAvatar, SetuButton } from "../setu-ui";
import { Log121Dialog, MemberFormDialog } from "./bni-forms";
import { ConvertRefsDialog } from "./bni-referral-dialogs";
import { MemberDialog } from "./member-dialog";
import { ChipPill, ClearFilters, FilterPanel, PanelSearch, SetuShell, TAG_TONE, Tag } from "./setu-shell";

type Filter = "all" | "pending" | "followup" | "converted";
const FILTERS: Filter[] = ["all", "pending", "followup", "converted"];
const FILTER_META: Record<Filter, { label: string; icon: React.ElementType }> = {
  all: { label: "All", icon: LayoutGrid },
  pending: { label: "Refs to convert", icon: Link2 },
  followup: { label: "Follow up", icon: ListChecks },
  converted: { label: "Converted", icon: CheckCircle2 },
};

const matches = (s: MemberSummary, f: Filter) =>
  f === "pending" ? s.pendingRefs.length > 0 : f === "followup" ? s.openTodos > 0 : f === "converted" ? s.prospects.length > 0 : true;

/** Setu → 121 Meetings: one card per BNI member with their latest 121 and referral totals. */
export function MeetingsView() {
  const deals = useSetuStore((s) => s.deals);
  const notes = useSetuStore((s) => s.notes);
  const meetings = useSetuStore((s) => s.meetings);
  const [q, setQ] = useUrlState("q", "");
  const [filter, setFilter] = useUrlState<Filter>("show", "all", { allowed: FILTERS });
  // In the URL so other pages can link straight to a member (ROUTES.setuMember).
  const [memberParam, setMemberParam] = useUrlState("member", "");
  const openMember = memberParam || null;
  const setOpenMember = (id: string | null) => setMemberParam(id ?? "");
  const [logOpen, setLogOpen] = usePageViewState("Setu121:log", false);
  const [addMember, setAddMember] = usePageViewState("Setu121:addMember", false);
  const [convertFor, setConvertFor] = usePageViewState<string | null>("Setu121:convert", null);

  const all = useMemo(() => memberSummaries(deals, notes, meetings), [deals, notes, meetings]);
  const rows = all.filter((s) => matches(s, filter) && matchesText(q, s.member.contactName, s.member.company, s.member.source, s.member.phone));
  const convertMember = deals.find((d) => d.id === convertFor);
  const totals = useMemo(
    () => ({
      meetings: all.reduce((n, s) => n + s.meetings.length, 0),
      pending: all.reduce((n, s) => n + s.pendingRefs.length, 0),
      followUps: all.reduce((n, s) => n + s.openTodos, 0),
    }),
    [all]
  );

  const exportCsv = () => {
    if (!rows.length) return toast.info("No 121s to export");
    downloadCsv(
      `setu-121-meetings-${isoDate(new Date())}.csv`,
      toCsv([
        ["Member", "Connected Via", "Phone", "Last Meeting", "Type", "Meetings", "Refs Received", "Refs Given", "Pending Conversion", "Prospects", "Open To-dos"],
        ...rows.map((s) => [
          s.member.contactName,
          s.member.source,
          s.member.phone,
          s.lastMeeting ? formatDate(s.lastMeeting.startAt) : "",
          s.lastMeeting?.type ?? "",
          s.meetings.length,
          s.refsReceived,
          s.refsGiven,
          s.pendingRefs.length,
          s.prospects.length,
          s.openTodos,
        ]),
      ])
    );
    toast.success(`Exported ${rows.length} members`);
  };

  return (
    <SetuShell
      tab="meetings"
      title="121 Meetings"
      subtitle="One-on-one conversations with BNI members and the referrals exchanged."
      hint={
        <>
          <span className="font-semibold text-[var(--setu-accent)]">{totals.meetings} meetings</span> • <span className="font-semibold text-amber-600 dark:text-amber-400">{totals.pending} referrals to convert</span> •{" "}
          <span className="font-semibold text-[var(--setu-text)]">{totals.followUps} follow-ups</span> — referrals received here become <strong className="text-[var(--setu-text)]">Prospects</strong> on the Sales Pipeline.
          Log on the go through the WhatsApp Bot.
        </>
      }
      actions={
        <>
          <SetuButton variant="muted" onClick={exportCsv}>
            <Download /> Export
          </SetuButton>
          <SetuButton onClick={() => setAddMember(true)}>
            <UserPlus /> Add Member
          </SetuButton>
          <SetuButton variant="solid" onClick={() => setLogOpen(true)}>
            <Plus /> Log 121 Meeting
          </SetuButton>
        </>
      }
    >
      <FilterPanel
        chips={FILTERS.map((f) => (
          <ChipPill key={f} active={filter === f} onClick={() => setFilter(f)} icon={FILTER_META[f].icon} label={FILTER_META[f].label} count={all.filter((s) => matches(s, f)).length} />
        ))}
      >
        <PanelSearch value={q} onChange={setQ} placeholder="Search members by name, business, connector, phone…" />
        <ClearFilters
          show={Boolean(q) || filter !== "all"}
          onClick={() => {
            setQ("");
            setFilter("all");
          }}
        />
      </FilterPanel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" data-scroll-key="setu-121-grid">
        {rows.map((s) => (
          <MemberCard key={s.member.id} s={s} onOpen={() => setOpenMember(s.member.id)} onConvert={() => setConvertFor(s.member.id)} />
        ))}
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--setu-line-strong)] bg-[var(--setu-card)] text-[var(--setu-text-3)] transition-colors hover:border-[var(--setu-accent)] hover:text-[var(--setu-accent)]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
            <Plus size={20} />
          </span>
          <span className="text-sm font-semibold">Log 121 Meeting</span>
          <span className="text-[11px]">or send notes through the WhatsApp Bot</span>
        </button>
      </div>
      {all.length > 0 && rows.length === 0 && <p className="setu-text-2 py-6 text-center text-sm">No members match. Clear the search or filter.</p>}

      <MemberDialog memberId={openMember} onClose={() => setOpenMember(null)} />
      <Log121Dialog open={logOpen} onClose={() => setLogOpen(false)} />
      <MemberFormDialog open={addMember} onClose={() => setAddMember(false)} onSaved={(m) => setOpenMember(m.id)} />
      <ConvertRefsDialog open={Boolean(convertMember)} onClose={() => setConvertFor(null)} member={convertMember} />
    </SetuShell>
  );
}

function MemberCard({ s, onOpen, onConvert }: { s: MemberSummary; onOpen: () => void; onConvert: () => void }) {
  const m = s.member;
  // The most advanced stage any of this member's referrals reached (shown as a tag).
  const order = (id: string) => BNI_STAGES.findIndex((x) => x.id === id);
  const top = s.prospects.map(bniStageOf).sort((a, b) => order(b) - order(a))[0];
  const third = s.openTodos > 0 ? { v: s.openTodos, l: "Follow-ups", tone: "text-orange-600 dark:text-orange-400" } : { v: s.prospects.length, l: "Prospects", tone: "text-violet-600 dark:text-violet-400" };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="setu-card group relative flex cursor-pointer flex-col p-4 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--setu-accent-ring)]"
    >
      <GripVertical size={14} className="setu-text-3 absolute right-3 top-3 opacity-40" aria-hidden />
      <div className="flex items-center gap-3 pr-5">
        <SetuAvatar name={m.contactName} size="md" className="h-10 w-10 text-sm" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-sm font-bold group-hover:text-[var(--setu-accent)]">{m.contactName}</h3>
            <Tag className={TAG_TONE.pink}>BNI Member</Tag>
          </div>
          <p className="setu-text-2 truncate text-xs">
            {m.company !== m.contactName ? m.company : "Chapter member"} • {m.source ? `Co ${m.source}` : "Direct"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-[var(--setu-well)] px-3 py-2 text-[11px]">
        <span className="flex min-w-0 items-center gap-1.5 font-medium">
          <CalendarDays size={13} className="shrink-0 text-violet-500" />
          <span className="truncate">{s.lastMeeting ? s.lastMeeting.type : "No meeting logged yet"}</span>
        </span>
        {s.lastMeeting && (
          <span className="setu-text-2 flex shrink-0 items-center gap-1">
            <Clock3 size={11} /> {formatDate(s.lastMeeting.startAt)}
          </span>
        )}
      </div>

      {m.phone && (
        <a
          href={`tel:+${phoneDigits(m.phone)}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--setu-accent-soft)] px-3 py-2 text-xs font-medium text-[var(--setu-accent)] hover:brightness-95"
        >
          <Phone size={13} /> {m.phone}
        </a>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Mini v={s.refsReceived} l="Refs Received" tone="text-green-600 dark:text-green-400" />
        <Mini v={s.refsGiven} l="Refs Given" tone="text-blue-600 dark:text-blue-400" />
        <Mini v={third.v} l={third.l} tone={third.tone} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--setu-line)] pt-3">
        {s.openTodos > 0 && <Tag className={TAG_TONE.amber}>Follow Up</Tag>}
        {top && <Tag className={BNI_STAGE_BY_ID[top].pill}>{BNI_STAGE_BY_ID[top].label}</Tag>}
        {s.prospects.length > 0 && s.pendingRefs.length === 0 && <Tag className={TAG_TONE.green}>Converted ✓</Tag>}
        {s.pendingRefs.length > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConvert();
            }}
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-[#1d4ed8] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-[#1e40af] dark:bg-blue-600"
          >
            <ArrowRight size={12} /> Convert {s.pendingRefs.length} Ref{s.pendingRefs.length === 1 ? "" : "s"}
          </button>
        ) : (
          <span className="setu-text-3 ml-auto text-[10px]">Updated {formatDateTime(m.updatedAt)}</span>
        )}
      </div>
    </article>
  );
}

function Mini({ v, l, tone }: { v: number; l: string; tone: string }) {
  return (
    <div className={cn("rounded-lg border border-[var(--setu-line)] px-1.5 py-2 text-center")}>
      <p className={cn("text-lg font-bold leading-none tabular-nums", tone)}>{v}</p>
      <p className="setu-text-2 mt-1 text-[9px] font-semibold uppercase tracking-wide">{l}</p>
    </div>
  );
}
