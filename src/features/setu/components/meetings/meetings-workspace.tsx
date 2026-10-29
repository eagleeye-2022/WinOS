"use client";

import { Download, Handshake, Plus, Users2 } from "lucide-react";
import { toast } from "@/components/shared/toast";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { useSetuStore } from "../../store";
import { EmptyState, FilterChips, IconTile, SearchInput, SetuButton, SetuPage } from "../setu-ui";
import { LogMeetingDialog } from "./log-meeting-dialog";
import { MeetingCard } from "./meeting-card";
import { MeetingDetailDialog } from "./meeting-detail-dialog";

type MeetingFilter = "all" | "pending" | "converted" | "bot";
const FILTERS: readonly MeetingFilter[] = ["all", "pending", "converted", "bot"];

export function MeetingsWorkspace() {
  const meetings = useSetuStore((s) => s.meetings);
  const convertReferrals = useSetuStore((s) => s.convertReferrals);
  const [q, setQ] = useUrlState("q", "");
  const [filter, setFilter] = useUrlState<MeetingFilter>("filter", "all", { allowed: FILTERS });
  const [openId, setOpenId] = useUrlState("open", "", { history: "push" });
  const [isNew, setIsNew] = useUrlState("new", "", { history: "push" });

  const matches = {
    all: () => true,
    pending: (m: (typeof meetings)[number]) => m.pendingReferralNames.length > 0,
    converted: (m: (typeof meetings)[number]) => m.prospectIds.length > 0,
    bot: (m: (typeof meetings)[number]) => m.capturedViaBot,
  } satisfies Record<MeetingFilter, (m: (typeof meetings)[number]) => boolean>;

  const needle = q.trim().toLowerCase();
  const visible = [...meetings]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter(matches[filter])
    .filter((m) => !needle || `${m.memberName} ${m.business} ${m.connectedVia} ${m.phone}`.toLowerCase().includes(needle));

  const openMeeting = meetings.find((m) => m.id === openId) ?? null;

  const convert = (id: string) => {
    const n = convertReferrals(id);
    if (n > 0) toast.success(`${n} referral${n === 1 ? "" : "s"} added to the pipeline as Prospects`);
  };

  return (
    <SetuPage
      icon={Handshake}
      title="121 Meetings"
      description="One-on-ones with BNI members. Referrals received here become Prospects in the Sales Pipeline."
      actions={
        <>
          <SetuButton onClick={() => toast.info("Export will be available with the backend")}>
            <Download /> Export
          </SetuButton>
          <SetuButton variant="primary" onClick={() => setIsNew("1")}>
            <Plus /> Log 121 Meeting
          </SetuButton>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search member, business, phone…" />
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: meetings.length },
            { value: "pending", label: "Refs to convert", count: meetings.filter(matches.pending).length },
            { value: "converted", label: "In pipeline", count: meetings.filter(matches.converted).length },
            { value: "bot", label: "Via WhatsApp bot", count: meetings.filter(matches.bot).length },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Users2} text="No meetings match these filters." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((m) => (
            <MeetingCard key={m.id} meeting={m} onOpen={() => setOpenId(m.id)} onConvert={() => convert(m.id)} />
          ))}
          <button
            type="button"
            onClick={() => setIsNew("1")}
            className="setu-text-3 flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-[var(--setu-line-strong)] text-sm transition-colors hover:border-[var(--setu-accent)] hover:text-[var(--setu-text)]"
          >
            <IconTile icon={Plus} size={44} glow />
            Log 121 Meeting
          </button>
        </div>
      )}

      <MeetingDetailDialog meeting={openMeeting} onClose={() => setOpenId("")} />
      <LogMeetingDialog open={isNew === "1"} onClose={() => setIsNew("")} />
    </SetuPage>
  );
}
