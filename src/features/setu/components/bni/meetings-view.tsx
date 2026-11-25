"use client";

import { useMemo } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Download, LayoutGrid, Link2, ListChecks, Phone, Plus, UserPlus } from "lucide-react";
import { toast } from "@/components/shared/toast";
import { usePageViewState, useUrlState } from "@/lib/navigation/use-url-state";
import { BNI_STAGES, bniStageOf, memberSummaries, type MemberSummary } from "../../bni";
import { downloadCsv, matchesText, toCsv } from "../../insights";
import { useSetuStore } from "../../provider";
import { formatDate, formatDateTime, isoDate, phoneDigits } from "../../utils";
import { SetuAvatar, SetuButton } from "../setu-ui";
import { Log121Dialog, MemberFormDialog } from "./bni-forms";
import { ConvertRefsDialog } from "./bni-referral-dialogs";
import { MemberDialog } from "./member-dialog";
import { ChipPill, ClearFilters, FilterPanel, PanelSearch, SetuShell, StageTag, TAG_TONE, Tag } from "./setu-shell";

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
          <span className="text-sm font-medium">Log 121 Meeting</span>
        </button>
      </div>
      {all.length > 0 && rows.length === 0 && <p className="setu-text-2 py-6 text-center text-sm">No members match</p>}

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
  const third = s.openTodos > 0 ? { v: s.openTodos, l: "Follow-ups" } : { v: s.prospects.length, l: "Prospects" };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="setu-card group relative flex cursor-pointer flex-col p-4 transition-colors hover:border-[var(--setu-line-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--setu-accent-ring)]"
    >
      <div className="flex items-center gap-3">
        <SetuAvatar name={m.contactName} size="md" className="h-10 w-10 text-sm" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold group-hover:text-[var(--setu-accent)]">{m.contactName}</h3>
            <Tag className={TAG_TONE.neutral}>BNI Member</Tag>
          </div>
          <p className="setu-text-2 truncate text-xs">
            {m.company !== m.contactName ? m.company : "Chapter member"} • {m.source ? `Co ${m.source}` : "Direct"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-[var(--setu-well)] px-3 py-2 text-[11px]">
        <span className="flex min-w-0 items-center gap-1.5 font-medium">
          <CalendarDays size={13} className="setu-text-3 shrink-0" />
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
        <Mini v={s.refsReceived} l="Refs received" />
        <Mini v={s.refsGiven} l="Refs given" />
        <Mini v={third.v} l={third.l} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--setu-line)] pt-3">
        {s.openTodos > 0 && <Tag className={TAG_TONE.amber}>Follow up</Tag>}
        {top && <StageTag stage={top} />}
        {s.prospects.length > 0 && s.pendingRefs.length === 0 && <Tag className={TAG_TONE.green}>Converted</Tag>}
        {s.pendingRefs.length > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConvert();
            }}
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-[var(--setu-solid)] px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-[var(--setu-solid-hover)]"
          >
            <ArrowRight size={12} /> Convert {s.pendingRefs.length} ref{s.pendingRefs.length === 1 ? "" : "s"}
          </button>
        ) : (
          <span className="setu-text-3 ml-auto text-[11px] tabular-nums">Updated {formatDateTime(m.updatedAt)}</span>
        )}
      </div>
    </article>
  );
}

function Mini({ v, l }: { v: number; l: string }) {
  return (
    <div className="rounded-lg border border-[var(--setu-line)] px-2 py-2 text-center">
      <p className="text-lg font-semibold leading-none tabular-nums">{v}</p>
      <p className="setu-text-2 mt-1 truncate text-[11px]">{l}</p>
    </div>
  );
}
