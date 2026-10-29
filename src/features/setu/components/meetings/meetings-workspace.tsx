"use client";

import { Download, Plus } from "lucide-react";
import { toast } from "@/components/shared/toast";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { useSetuStore } from "../../store";
import { IconTile, SetuButton, SetuSection } from "../setu-ui";
import { LogMeetingDialog } from "./log-meeting-dialog";
import { MeetingCard } from "./meeting-card";
import { MeetingDetailDialog } from "./meeting-detail-dialog";

export function MeetingsWorkspace() {
  const meetings = useSetuStore((s) => s.meetings);
  const convertReferrals = useSetuStore((s) => s.convertReferrals);
  const [openId, setOpenId] = useUrlState("open", "", { history: "push" });
  const [isNew, setIsNew] = useUrlState("new", "", { history: "push" });

  const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
  const openMeeting = meetings.find((m) => m.id === openId) ?? null;

  const convert = (id: string) => {
    const n = convertReferrals(id);
    if (n > 0) toast.success(`${n} referral${n === 1 ? "" : "s"} added to the pipeline as Prospects`);
  };

  return (
    <div className="space-y-6">
      <SetuSection
        title="121 Meeting Log"
        actions={
          <>
            <SetuButton onClick={() => setIsNew("1")}>
              <Plus /> Add 121
            </SetuButton>
            <SetuButton variant="primary" onClick={() => toast.info("Export will be available with the backend")}>
              <Download /> Export
            </SetuButton>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {sorted.map((m) => (
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
      </SetuSection>

      <MeetingDetailDialog meeting={openMeeting} onClose={() => setOpenId("")} />
      <LogMeetingDialog open={isNew === "1"} onClose={() => setIsNew("")} />
    </div>
  );
}
