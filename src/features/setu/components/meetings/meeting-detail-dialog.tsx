"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarPlus, CircleCheck, Phone, PhoneCall, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/shared/toast";
import { MEETING_TYPE_LABEL, PIPELINE_STAGES, STAGE_BY_ID } from "../../constants";
import { useSetuStore } from "../../store";
import type { Meeting121, PipelineStageId } from "../../types";
import { formatDate } from "../../utils";
import { Pill, SectionLabel, SetuAvatar, SetuButton } from "../setu-ui";

/** The stage after `stage` in the active funnel ("→ Proposal next"), if any. */
function nextStage(stage: PipelineStageId) {
  const funnel = PIPELINE_STAGES.filter((s) => !s.closed && s.id !== "OPPORTUNITY");
  const i = funnel.findIndex((s) => s.id === stage);
  return i >= 0 ? (funnel[i + 1] ?? STAGE_BY_ID.WON) : undefined;
}

/**
 * 121 meeting detail — left: referral summary, notes, to-dos, convert; right: member card
 * (Call now / Schedule via Zoho Calendar / Convert) and the pipeline stage it reached.
 */
export function MeetingDetailDialog({ meeting, onClose }: { meeting: Meeting121 | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(meeting)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="setu-scope setu-dialog flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        {meeting && <MeetingDetailBody key={meeting.id} meeting={meeting} />}
      </DialogContent>
    </Dialog>
  );
}

function MeetingDetailBody({ meeting }: { meeting: Meeting121 }) {
  const prospects = useSetuStore((s) => s.prospects);
  const convertReferrals = useSetuStore((s) => s.convertReferrals);
  const addMeetingNote = useSetuStore((s) => s.addMeetingNote);
  const toggleTodo = useSetuStore((s) => s.toggleTodo);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);

  const linked = prospects.filter((p) => meeting.prospectIds.includes(p.id));
  const lead = linked[0];
  const pending = meeting.pendingReferralNames;

  const convert = () => {
    const n = convertReferrals(meeting.id);
    if (n > 0) toast.success(`${n} referral${n === 1 ? "" : "s"} added to the pipeline as Prospects`);
  };

  const saveNote = (text: string) => {
    const t = text.trim();
    if (!t) return;
    addMeetingNote(meeting.id, t);
    setNote("");
    setNoteOpen(false);
  };

  return (
    <>
      <div className="border-b border-[var(--setu-line)] px-7 py-5 pr-14">
        <DialogTitle className="setu-heading text-lg font-semibold">
          {meeting.memberName} — {MEETING_TYPE_LABEL[meeting.type]}
        </DialogTitle>
        <DialogDescription className="setu-text-2 mt-1 text-xs">
          {meeting.connectedVia || "Direct"} · BNI Chapter · {formatDate(meeting.date)}
          {pending.length === 0 && linked.length > 0 && " · Converted to Prospect ✓"}
        </DialogDescription>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        {/* LEFT: notes */}
        <div className="flex-1 space-y-7 p-7 md:overflow-y-auto">
          <section>
            <SectionLabel>Referral summary</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div className="setu-chip p-4 text-center">
                <div className="text-3xl font-bold leading-none text-green-500">{meeting.refsReceived}</div>
                <div className="setu-text-3 mt-1.5 text-xs">Refs Received</div>
              </div>
              <div className="setu-chip p-4 text-center">
                <div className="setu-accent-text text-3xl font-bold leading-none">{meeting.refsGiven}</div>
                <div className="setu-text-3 mt-1.5 text-xs">Refs Given</div>
              </div>
            </div>
          </section>

          <section>
            <SectionLabel>Meeting notes</SectionLabel>
            <ol className="space-y-2.5">
              {meeting.notes.map((n) => (
                <li key={n.id} className="flex gap-3 text-sm">
                  <span className="setu-text-3 w-12 shrink-0 pt-0.5 text-[11px] font-semibold">{formatDate(n.date, true)}</span>
                  <span className="leading-relaxed">{n.text}</span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <SectionLabel>To-do</SectionLabel>
            {meeting.todos.length === 0 ? (
              <p className="setu-text-3 text-sm">No to-dos.</p>
            ) : (
              <ul className="space-y-2.5">
                {meeting.todos.map((t) => (
                  <li key={t.id} className="flex items-center gap-2.5 text-sm">
                    <Checkbox checked={t.done} onCheckedChange={() => toggleTodo(meeting.id, t.id)} id={`todo-${t.id}`} />
                    <label htmlFor={`todo-${t.id}`} className={cn("cursor-pointer", t.done && "setu-text-3 line-through")}>
                      {t.text}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {pending.length > 0 ? (
            <div className="setu-chip relative overflow-hidden p-4">
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-green-500/20 blur-2xl" />
              <div className="relative flex items-center gap-2 text-sm font-semibold">
                <Sparkles size={15} className="text-green-500" /> {pending.length} referral{pending.length === 1 ? "" : "s"} to convert
              </div>
              <div className="relative mt-2 flex flex-wrap gap-1.5">
                {pending.map((name) => (
                  <Pill key={name}>{name}</Pill>
                ))}
              </div>
              <p className="setu-text-3 relative mt-2 text-xs">Add via the WhatsApp Bot or click “Convert refs” on the meeting card.</p>
            </div>
          ) : (
            lead && (
              <div className="setu-chip flex items-start gap-2 p-4 text-sm">
                <CircleCheck size={16} className="setu-accent-text mt-0.5 shrink-0" />
                <span>
                  <strong className="font-semibold">Converted to Prospect</strong>
                  <span className="setu-text-2"> — now in the Sales Pipeline: {STAGE_BY_ID[lead.stage].label} stage</span>
                </span>
              </div>
            )
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {pending.length > 0 && (
                <SetuButton variant="primary" size="sm" onClick={convert}>
                  Convert all refs to Prospects <ArrowRight />
                </SetuButton>
              )}
              <SetuButton size="sm" onClick={() => setNoteOpen((o) => !o)}>
                <Plus /> Add note
              </SetuButton>
            </div>
            {noteOpen && (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveNote(note)}
                  placeholder="What happened?"
                  className="setu-input h-9"
                />
                <SetuButton size="sm" variant="primary" onClick={() => saveNote(note)}>
                  Save
                </SetuButton>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: member info + call now */}
        <aside className="w-full shrink-0 space-y-7 border-t border-[var(--setu-line)] bg-[var(--setu-card-2)] p-6 md:w-72 md:overflow-y-auto md:border-l md:border-t-0">
          <section>
            <SectionLabel>{linked.length > 0 && pending.length === 0 ? "Contact info" : "Member info"}</SectionLabel>
            <div className="setu-chip p-5 text-center">
              <div className="flex justify-center">
                <SetuAvatar name={meeting.memberName} size="lg" />
              </div>
              <div className="mt-3 text-sm font-semibold">{meeting.memberName}</div>
              <div className="setu-text-3 text-xs">
                {meeting.connectedVia || meeting.business} · BNI Pinnacle
              </div>
              <div className="setu-text-2 mt-1.5 flex items-center justify-center gap-1 text-xs">
                <Phone size={11} /> {meeting.phone || "Not captured yet"}
              </div>
              <SetuButton variant="success" size="sm" onClick={() => setCallOpen(true)} className="mt-4 w-full">
                <PhoneCall /> Call now
              </SetuButton>
              <button
                type="button"
                className="setu-chip mt-2 flex w-full cursor-pointer flex-col items-center py-1.5 transition-colors hover:border-[var(--setu-text-3)]"
                onClick={() => toast.info("Zoho Calendar scheduling will be wired up with the backend")}
              >
                <span className="setu-accent-text inline-flex items-center gap-1.5 text-xs font-semibold">
                  <CalendarPlus size={14} /> Schedule meeting
                </span>
                <span className="setu-text-3 text-[10px]">via Zoho Calendar</span>
              </button>
              <div className="setu-chip setu-text-2 mt-2 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Zoho Calendar Integration
              </div>
              {pending.length > 0 && (
                <SetuButton variant="primary" size="sm" className="mt-2 w-full" onClick={convert}>
                  Convert refs to Prospects
                </SetuButton>
              )}
            </div>
          </section>

          <section>
            <SectionLabel>Pipeline stage</SectionLabel>
            {lead ? (
              <Link
                href={`/setu/pipeline?open=${lead.id}`}
                className="setu-chip block px-4 py-3 text-sm transition-colors hover:border-[var(--setu-text-3)]"
              >
                <div className="flex items-center gap-2 font-semibold">
                  <span className={cn("h-2 w-2 rounded-full", STAGE_BY_ID[lead.stage].dot)} />
                  {STAGE_BY_ID[lead.stage].label}
                </div>
                {nextStage(lead.stage) && (
                  <div className="setu-text-3 mt-0.5 text-[11px]">→ {nextStage(lead.stage)?.short} next</div>
                )}
                {linked.length > 1 && <div className="setu-text-3 mt-0.5 text-[11px]">+{linked.length - 1} more prospects from this meeting</div>}
              </Link>
            ) : (
              <div className="setu-chip px-4 py-3 text-sm">
                <div className="font-semibold">121 Meeting</div>
                <div className="setu-text-3 mt-0.5 text-[11px]">
                  {pending.length > 0 ? "→ Referrals pending conversion" : "→ No prospects yet"}
                </div>
              </div>
            )}
          </section>
        </aside>

        {callOpen && (
          <CallNoteOverlay
            name={meeting.memberName}
            onCancel={() => setCallOpen(false)}
            onSave={(text) => {
              saveNote(`📞 ${text}`);
              setCallOpen(false);
              toast.success("Call note saved");
            }}
          />
        )}
      </div>
    </>
  );
}

/** "Call now" opens this over the dialog to capture what was said on the call. */
function CallNoteOverlay({ name, onCancel, onSave }: { name: string; onCancel: () => void; onSave: (text: string) => void }) {
  const [text, setText] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const now = new Date().toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="setu-card w-full max-w-sm p-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <PhoneCall size={15} className="text-green-500" /> Call note — {name}
        </div>
        <div className="setu-text-3 mb-4 mt-0.5 text-xs">{now}</div>
        <Textarea
          autoFocus
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="setu-input"
          placeholder="e.g. Agreed to meet on Wednesday. Will send portfolio link. 3 more referral names confirmed."
        />
        <label className="setu-text-2 mt-3 flex items-center gap-2 text-xs">
          <Checkbox checked={followUp} onCheckedChange={(v) => setFollowUp(v === true)} />
          Schedule follow-up meeting
        </label>
        <div className="mt-5 flex gap-2">
          <SetuButton variant="primary" size="sm" className="flex-1" disabled={!text.trim()} onClick={() => onSave(text.trim())}>
            Save note
          </SetuButton>
          <SetuButton size="sm" onClick={onCancel}>
            Cancel
          </SetuButton>
        </div>
      </div>
    </div>
  );
}
