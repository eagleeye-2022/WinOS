"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarPlus, Phone, PhoneCall, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/shared/toast";
import { MEETING_TYPE_LABEL } from "../../constants";
import { useSetuStore } from "../../store";
import type { Meeting121 } from "../../types";
import { formatDate } from "../../utils";
import { Pill, SectionLabel, SetuAvatar, SetuButton, StageBadge } from "../setu-ui";

/**
 * 121 meeting detail — left: referrals, notes, to-dos; right: member card with Call Now /
 * Schedule (Zoho Calendar) and the prospects this meeting fed into the pipeline.
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
  const [callOpen, setCallOpen] = useState(false);

  const linked = prospects.filter((p) => meeting.prospectIds.includes(p.id));
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
  };

  return (
    <>
      <div className="flex items-center gap-4 border-b border-[var(--setu-line)] px-7 py-5 pr-14">
        <span className="setu-tile p-1">
          <SetuAvatar name={meeting.memberName} />
        </span>
        <div className="min-w-0">
          <DialogTitle className="setu-heading text-lg font-semibold">{meeting.memberName}</DialogTitle>
          <DialogDescription className="setu-text-2 mt-0.5 text-xs">
            {MEETING_TYPE_LABEL[meeting.type]} · {meeting.connectedVia || "Direct"} · {formatDate(meeting.date)}
          </DialogDescription>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        {/* LEFT */}
        <div className="flex-1 space-y-7 p-7 md:overflow-y-auto">
          <section className="grid grid-cols-2 gap-3">
            <div className="setu-chip p-4">
              <div className="setu-heading text-3xl font-bold leading-none">{meeting.refsReceived}</div>
              <div className="setu-text-3 mt-1.5 text-xs">Refs received</div>
            </div>
            <div className="setu-chip p-4">
              <div className="setu-heading text-3xl font-bold leading-none">{meeting.refsGiven}</div>
              <div className="setu-text-3 mt-1.5 text-xs">Refs given</div>
            </div>
          </section>

          {pending.length > 0 && (
            <section className="setu-chip relative overflow-hidden p-5">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[var(--setu-accent-glow)] blur-2xl" />
              <div className="relative mb-3 flex items-center gap-2 text-sm font-semibold">
                <Sparkles size={15} className="setu-accent-text" />
                {pending.length} referral{pending.length === 1 ? "" : "s"} to convert
              </div>
              <div className="relative mb-4 flex flex-wrap gap-1.5">
                {pending.map((name) => (
                  <Pill key={name}>{name}</Pill>
                ))}
              </div>
              <SetuButton variant="primary" size="sm" onClick={convert} className="relative">
                Convert all to Prospects <ArrowRight />
              </SetuButton>
            </section>
          )}

          <section>
            <SectionLabel>Meeting notes</SectionLabel>
            <ol className="relative space-y-4 border-l border-[var(--setu-line-strong)] pl-5">
              {meeting.notes.map((n) => (
                <li key={n.id} className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full border border-[var(--setu-card)] bg-[var(--setu-accent)]" />
                  <div className="setu-text-3 text-[11px] font-medium">{formatDate(n.date, true)}</div>
                  <div className="mt-0.5 text-sm leading-relaxed">{n.text}</div>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex gap-2">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveNote(note)}
                placeholder="Add a note…"
                className="setu-input h-9"
              />
              <SetuButton size="sm" onClick={() => saveNote(note)}>
                Add
              </SetuButton>
            </div>
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
        </div>

        {/* RIGHT */}
        <aside className="w-full shrink-0 space-y-7 border-t border-[var(--setu-line)] bg-[var(--setu-card-2)] p-6 md:w-72 md:overflow-y-auto md:border-l md:border-t-0">
          <section>
            <SectionLabel>Member</SectionLabel>
            <div className="setu-chip p-5 text-center">
              <div className="flex justify-center">
                <span className="setu-tile p-1.5">
                  <SetuAvatar name={meeting.memberName} size="lg" />
                </span>
              </div>
              <div className="mt-3 text-sm font-semibold">{meeting.memberName}</div>
              <div className="setu-text-3 text-xs">{meeting.business}</div>
              <div className="setu-text-2 mt-1.5 flex items-center justify-center gap-1 text-xs">
                <Phone size={11} /> {meeting.phone || "Not captured yet"}
              </div>
              <SetuButton variant="primary" size="sm" onClick={() => setCallOpen(true)} className="mt-4 w-full">
                <PhoneCall /> Call now
              </SetuButton>
              <SetuButton
                size="sm"
                className="mt-2 w-full"
                onClick={() => toast.info("Zoho Calendar scheduling will be wired up with the backend")}
              >
                <CalendarPlus /> Schedule meeting
              </SetuButton>
              <div className="setu-text-3 mt-2.5 flex items-center justify-center gap-1.5 text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> via Zoho Calendar
              </div>
            </div>
          </section>

          <section>
            <SectionLabel>In the pipeline</SectionLabel>
            {linked.length === 0 ? (
              <p className="setu-text-3 text-xs">
                {pending.length > 0 ? "Referrals pending conversion." : "Nothing in the pipeline from this meeting."}
              </p>
            ) : (
              <ul className="space-y-2">
                {linked.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/setu/pipeline?open=${p.id}`}
                      className="setu-chip flex items-center justify-between gap-2 px-3 py-2 text-xs transition-colors hover:border-[var(--setu-text-3)]"
                    >
                      <span className="truncate font-medium">{p.name}</span>
                      <StageBadge stage={p.stage} />
                    </Link>
                  </li>
                ))}
              </ul>
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
        <div className="text-sm font-semibold">Call note — {name}</div>
        <div className="setu-text-3 mb-4 text-xs">{now}</div>
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
          Schedule a follow-up meeting
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
