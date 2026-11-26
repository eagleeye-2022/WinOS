"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, CalendarPlus, Clock3, Link2, MessageCircle, PencilLine, Phone, PhoneCall, Plus, StickyNote, Trash2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePageViewState } from "@/lib/navigation/use-url-state";
import { NOTE_TODO_DONE, bniStageOf, memberSummaries, memberTimeline, textToHtml } from "../../bni";
import { useBni } from "../../bni-client";
import { useSetuStore } from "../../provider";
import { formatDate, phoneDigits } from "../../utils";
import { SetuAvatar, SetuButton, attempt } from "../setu-ui";
import { BniDialog } from "./bni-dialog";
import { Log121Dialog, MemberFormDialog } from "./bni-forms";
import { CallNoteDialog, ConvertRefsDialog, ReferralDialog } from "./bni-referral-dialogs";
import { StageTag } from "./setu-shell";

type Sub = "call" | "convert" | "edit" | "log" | "ref" | null;

/** A member's 121 record: referral summary, meeting notes, to-dos (left); contact & actions (right). */
export function MemberDialog({ memberId, onClose }: { memberId: string | null; onClose: () => void }) {
  const deals = useSetuStore((s) => s.deals);
  const notes = useSetuStore((s) => s.notes);
  const meetings = useSetuStore((s) => s.meetings);
  const calls = useSetuStore((s) => s.calls);
  const addNote = useSetuStore((s) => s.addNote);
  const bni = useBni();
  const [sub, setSub] = usePageViewState<Sub>("MemberDialog:sub", null);
  const [noteText, setNoteText] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [todoText, setTodoText] = useState("");

  const summary = useMemo(() => (memberId ? memberSummaries(deals, notes, meetings).find((s) => s.member.id === memberId) : undefined), [deals, notes, meetings, memberId]);
  const timeline = useMemo(() => (memberId ? memberTimeline(memberId, notes, meetings, calls) : []), [memberId, notes, meetings, calls]);
  const m = summary?.member;

  const saveNote = async () => {
    if (!m || !noteText.trim()) return;
    const ok = await attempt(addNote(m.id, { title: "Note", body: textToHtml(noteText), pinned: false, category: "NOTE" }), "Note added");
    if (ok) {
      setNoteText("");
      setNoteOpen(false);
    }
  };
  const addTodo = async () => {
    if (!m || !todoText.trim()) return;
    if (await attempt(bni.addTodo(m.id, todoText))) setTodoText("");
  };

  return (
    <>
      <BniDialog
        open={Boolean(memberId && m)}
        onClose={onClose}
        width="max-w-[880px]"
        badge={<span className="rounded-md bg-[var(--setu-well)] px-2 py-0.5 text-[11px] font-medium text-[var(--setu-text-2)]">121 Meeting</span>}
        title={m ? m.contactName : "121 Meeting"}
        description={m ? [m.source ? `Co ${m.source}` : "Direct BNI", m.company !== m.contactName ? m.company : "BNI Member"].filter(Boolean).join(" · ") : undefined}
      >
        {m && summary && (
          <div className="grid bg-[var(--setu-canvas)] md:grid-cols-[1fr_270px]">
            {/* Left: referrals, notes, to-dos */}
            <div className="space-y-5 border-[var(--setu-line)] px-6 py-5 md:border-r">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--setu-line)] bg-[var(--setu-card)] px-4 py-3 text-sm">
                <span className="flex items-center gap-2">
                  <Clock3 size={15} className="text-[var(--setu-accent)]" />
                  <span className="setu-text-2">Last 121:</span>
                  <span className="font-medium tabular-nums">{summary.lastMeeting ? formatDate(summary.lastMeeting.startAt) : "Not logged yet"}</span>
                </span>
                {summary.lastMeeting && (
                  <span className="flex items-center gap-1.5 text-xs">
                    <span className="setu-text-2">Type:</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--setu-accent-soft)] px-2 py-0.5 font-medium text-[var(--setu-accent)]">
                      <CalendarDays size={12} /> {summary.lastMeeting.type}
                    </span>
                  </span>
                )}
              </div>
              <Section title="Referral summary">
                <div className="grid grid-cols-3 gap-2">
                  <Pill value={summary.refsReceived} label="Refs received" />
                  <Pill value={summary.refsGiven} label="Refs given" />
                  <Pill value={summary.pendingRefs.length} label="Pending conversion" tone={summary.pendingRefs.length ? "text-amber-600 dark:text-amber-400" : undefined} />
                </div>
              </Section>

              <Section
                title="Meeting notes"
                action={
                  <button type="button" onClick={() => setNoteOpen((o) => !o)} className="setu-accent-text inline-flex items-center gap-1 text-xs font-medium hover:underline">
                    <Plus size={12} /> Add Note
                  </button>
                }
              >
                {noteOpen && (
                  <div className="mb-3 space-y-2">
                    <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} placeholder="What happened…" className="setu-input text-sm" autoFocus />
                    <div className="flex justify-end gap-2">
                      <SetuButton size="sm" variant="ghost" onClick={() => setNoteOpen(false)}>
                        Cancel
                      </SetuButton>
                      <SetuButton size="sm" variant="solid" onClick={saveNote} disabled={!noteText.trim()}>
                        Save Note
                      </SetuButton>
                    </div>
                  </div>
                )}
                {timeline.length === 0 ? (
                  <p className="setu-text-3 text-xs">No notes yet</p>
                ) : (
                  <ul className="space-y-3">
                    {timeline.map((e) => (
                      <li key={`${e.kind}-${e.id}`} className="flex gap-3">
                        <span className="setu-text-3 w-12 shrink-0 pt-0.5 text-[11px] tabular-nums">{formatDate(e.at).slice(0, 6)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-xs font-medium">
                            {e.kind === "MEETING" ? <CalendarDays size={12} className="setu-text-3" /> : e.kind === "CALL" ? <PhoneCall size={12} className="setu-text-3" /> : <StickyNote size={12} className="setu-text-3" />}
                            {e.title}
                          </p>
                          {e.text && <p className="mt-0.5 text-xs leading-relaxed text-[var(--setu-text)]">{e.text}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="To-Do">
                <ul className="space-y-1">
                  {summary.todos.map((t) => (
                    <li key={t.id} className="group flex items-center gap-2 text-xs">
                      <Checkbox checked={t.title === NOTE_TODO_DONE} onCheckedChange={() => void attempt(bni.toggleTodo(t.id))} aria-label={t.body} />
                      <span className={cn("flex-1", t.title === NOTE_TODO_DONE && "setu-text-3 line-through")}>{t.body}</span>
                      <button
                        type="button"
                        onClick={() => void attempt(bni.deleteBniNote(t.id), "To-do removed")}
                        className="setu-text-3 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                        aria-label="Remove to-do"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void addTodo();
                  }}
                >
                  <Input value={todoText} onChange={(e) => setTodoText(e.target.value)} placeholder="Add a to-do (e.g. Send portfolio before meeting)" className="setu-input h-8 text-xs" />
                  <SetuButton size="sm" type="submit" disabled={!todoText.trim()}>
                    Add
                  </SetuButton>
                </form>
              </Section>

              {summary.pendingRefs.length > 0 ? (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5 text-xs text-green-700 dark:border-green-500/25 dark:bg-green-500/10 dark:text-green-400">
                  <strong className="font-medium">
                    {summary.pendingRefs.length} referral{summary.pendingRefs.length === 1 ? "" : "s"} to convert
                  </strong>
                </div>
              ) : summary.prospects.length > 0 ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-700 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-300">
                  <strong className="font-medium">Converted to prospects</strong> — {summary.prospects.length} on the Sales Pipeline.
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <SetuButton variant="solid" size="sm" onClick={() => setSub("convert")} disabled={!summary.pendingRefs.length}>
                  <ArrowRight /> Convert All Refs to Prospects
                </SetuButton>
                <SetuButton size="sm" onClick={() => setSub("ref")}>
                  <Link2 /> Log Referral
                </SetuButton>
                <SetuButton size="sm" onClick={() => setSub("log")}>
                  <CalendarPlus /> Log another 121
                </SetuButton>
              </div>
            </div>

            {/* Right: contact + actions */}
            <aside className="space-y-5 px-5 py-5">
              <Section title="Member info">
                <div className="setu-card space-y-2 p-4 text-center">
                  <SetuAvatar name={m.contactName} className="mx-auto h-11 w-11 text-sm" />
                  <p className="text-sm font-semibold">{m.contactName}</p>
                  <p className="setu-text-2 text-[11px]">{[m.source ? `Co ${m.source}` : "", m.company !== m.contactName ? m.company : "BNI Member"].filter(Boolean).join(" · ")}</p>
                  <p className="setu-text-3 flex items-center justify-center gap-1 text-[11px]">
                    <Phone size={11} /> {m.phone || "Not captured yet"}
                  </p>
                  <div className="space-y-2 pt-1">
                    {m.phone ? (
                      <SetuButton variant="whatsapp" className="w-full" asChild>
                        <a href={`tel:+${phoneDigits(m.phone)}`} onClick={() => setSub("call")}>
                          <Phone /> Call Now
                        </a>
                      </SetuButton>
                    ) : (
                      <SetuButton variant="whatsapp" className="w-full" onClick={() => setSub("call")}>
                        <PhoneCall /> Add Call Note
                      </SetuButton>
                    )}
                    <SetuButton className="w-full" asChild>
                      <Link href={`${ROUTES.setuMeetingNew}?deal=${m.id}`}>
                        <CalendarPlus /> Schedule Meeting
                      </Link>
                    </SetuButton>
                    {m.phone && (
                      <SetuButton variant="ghost" className="w-full" asChild>
                        <a href={`https://wa.me/${phoneDigits(m.phone)}`} target="_blank" rel="noreferrer">
                          <MessageCircle /> WhatsApp
                        </a>
                      </SetuButton>
                    )}
                    <SetuButton variant="ghost" size="sm" className="w-full" onClick={() => setSub("edit")}>
                      <PencilLine /> Edit member
                    </SetuButton>
                  </div>
                </div>
              </Section>

              <Section title="Pipeline stage">
                <div className="rounded-lg border border-[var(--setu-line)] bg-[var(--setu-card)] px-3 py-2.5 text-xs">
                  <p className="font-medium">121 Meeting</p>
                  <p className="setu-text-2 mt-0.5 text-[11px]">
                    {summary.pendingRefs.length
                      ? `→ ${summary.pendingRefs.length} referral${summary.pendingRefs.length === 1 ? "" : "s"} pending conversion`
                      : summary.prospects.length
                        ? "→ Referrals converted"
                        : "→ No referrals yet"}
                  </p>
                </div>
                {summary.prospects.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {summary.prospects.map((p) => (
                      <li key={p.id}>
                        <Link href={ROUTES.setuDeal(p.id)} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs hover:bg-[var(--setu-soft)]">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <UserRound size={12} className="setu-text-3 shrink-0" />
                            <span className="truncate font-medium">{p.contactName}</span>
                          </span>
                          <StageTag stage={bniStageOf(p)} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {summary.meetings.length > 0 && (
                <Section title={`Meetings (${summary.meetings.length})`}>
                  <ul className="space-y-1 text-xs">
                    {summary.meetings.map((mt) => (
                      <li key={mt.id}>
                        <Link href={ROUTES.setuMeeting(mt.id)} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-[var(--setu-soft)]">
                          <span className="truncate">{mt.type}</span>
                          <span className="setu-text-3 shrink-0 text-[11px]">{formatDate(mt.startAt)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </aside>
          </div>
        )}
      </BniDialog>

      {m && (
        <>
          <CallNoteDialog open={sub === "call"} onClose={() => setSub(null)} deal={m} />
          <ConvertRefsDialog open={sub === "convert"} onClose={() => setSub(null)} member={m} />
          <MemberFormDialog open={sub === "edit"} onClose={() => setSub(null)} member={m} />
          <Log121Dialog open={sub === "log"} onClose={() => setSub(null)} memberId={m.id} />
          <ReferralDialog open={sub === "ref"} onClose={() => setSub(null)} memberId={m.id} />
        </>
      )}
    </>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="setu-text-2 text-xs font-medium">{title}</h4>
        {action}
      </div>
      {children}
    </section>
  );
}

function Pill({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-[var(--setu-line)] bg-[var(--setu-card)] px-3 py-2.5 text-center shadow-[var(--setu-shadow)]">
      <p className={cn("text-xl font-semibold tabular-nums", tone)}>{value}</p>
      <p className="setu-text-2 text-[11px]">{label}</p>
    </div>
  );
}
