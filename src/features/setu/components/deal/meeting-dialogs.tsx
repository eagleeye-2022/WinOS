"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CalendarPlus, CircleCheck, Clock3, Plus, UserPlus, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichDescriptionEditor, isEmptyDescription } from "@/components/shared/rich-description";
import { MEETING_CHANNEL_LABEL, isOnlineChannel } from "../../constants";
import { useSetuStore } from "../../provider";
import type { Deal, DealMeeting, MeetingAttendee, MeetingChannel } from "../../types";
import { displayCode, formatSpan, formatTimeRange, formatDate, isoDate, istDateTime, istHhmm, relativeDay } from "../../utils";
import { Field, SetuButton, attempt, useSetuUserName } from "../setu-ui";
import { SetuDrawer } from "../setu-drawer";
import { AddExternalAttendeeDialog, AttendeeChips, AttendeePicker, attendeeId } from "./meeting-attendees";

/**
 * "log" = record a meeting that already happened ("Add Meeting Details"); "edit" = edit a completed
 * one. Scheduling / rescheduling upcoming meetings happens on the full Schedule Meeting page.
 */
export type MeetingDialogMode = "log" | "edit";

const MODE_COPY: Record<MeetingDialogMode, { title: string; submit: string; icon: React.ElementType }> = {
  log: { title: "Add Meeting Details", submit: "Save Meeting", icon: CalendarPlus },
  edit: { title: "Edit Meeting Details", submit: "Save Changes", icon: CalendarClock },
};

const CHANNELS = Object.keys(MEETING_CHANNEL_LABEL) as MeetingChannel[];

interface MeetingForm {
  title: string;
  type: string;
  date: string;
  start: string;
  end: string;
  channel: MeetingChannel;
  link: string;
  location: string;
  agenda: string;
  attendees: MeetingAttendee[];
  summary: string;
  recordingUrl: string;
}

function initialForm(deal: Deal, meeting: DealMeeting | undefined): MeetingForm {
  if (meeting) {
    return {
      title: meeting.title,
      type: meeting.type,
      date: isoDate(meeting.startAt),
      start: istHhmm(meeting.startAt),
      end: istHhmm(meeting.endAt),
      channel: meeting.channel,
      link: meeting.link ?? "",
      location: meeting.location ?? "",
      agenda: meeting.agenda,
      attendees: meeting.attendees,
      summary: meeting.summary ?? "",
      recordingUrl: meeting.recordingUrl ?? "",
    };
  }
  const contact: MeetingAttendee = {
    id: attendeeId(),
    name: deal.contactName,
    role: deal.contactRole || undefined,
    email: deal.email || undefined,
    company: deal.company,
    external: true,
    source: "DEAL",
    rsvp: "ACCEPTED",
    attended: true,
  };
  return {
    title: "",
    type: "",
    date: isoDate(new Date()),
    start: "11:00",
    end: "12:00",
    channel: "GOOGLE_MEET",
    link: "",
    location: "",
    agenda: "",
    attendees: deal.contactName ? [contact] : [],
    summary: "",
    recordingUrl: "",
  };
}

export function MeetingFormDialog({
  deal,
  mode,
  meeting,
  open,
  onClose,
}: {
  deal: Deal;
  mode: MeetingDialogMode;
  meeting?: DealMeeting;
  open: boolean;
  onClose: () => void;
}) {
  const userName = useSetuUserName();
  const addMeeting = useSetuStore((s) => s.addMeeting);
  const updateMeeting = useSetuStore((s) => s.updateMeeting);
  const [form, setForm] = useState<MeetingForm>(() => initialForm(deal, meeting));
  const [error, setError] = useState("");
  const [externalOpen, setExternalOpen] = useState(false);
  const set = (patch: Partial<MeetingForm>) => setForm((f) => ({ ...f, ...patch }));
  const copy = MODE_COPY[mode];
  const online = isOnlineChannel(form.channel);

  useEffect(() => {
    if (open) {
      setForm(initialForm(deal, meeting));
      setError("");
    }
    // Reset each time it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meeting?.id, mode]);

  const addAttendee = (a: Omit<MeetingAttendee, "id">) => setForm((f) => ({ ...f, attendees: [...f.attendees, { ...a, id: attendeeId(), attended: true }] }));

  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const problem = !form.title.trim()
      ? "Meeting title is required."
      : !form.date || !form.start || !form.end
        ? "Pick the date, start and end time."
        : form.end <= form.start
          ? "End time must be after the start time."
          : online && form.link.trim() && !/^https?:\/\//i.test(form.link.trim())
            ? "The meeting link must start with http(s)://"
            : isEmptyDescription(form.summary)
              ? "Add the meeting summary."
              : "";
    setError(problem);
    if (problem) return;

    const data = {
      title: form.title.trim(),
      type: form.type.trim() || "Meeting",
      startAt: istDateTime(form.date, form.start),
      endAt: istDateTime(form.date, form.end),
      channel: form.channel,
      link: online ? form.link.trim() || undefined : undefined,
      location: online ? undefined : form.location.trim() || undefined,
      agenda: form.agenda,
      attendees: form.attendees,
      summary: form.summary,
      recordingUrl: form.recordingUrl.trim() || undefined,
      reminder: meeting?.reminder ?? ("30m" as const),
    };
    setSaving(true);
    const saved = await attempt(meeting ? updateMeeting(meeting.id, data) : addMeeting(deal.id, data, "COMPLETED"), meeting ? "Meeting updated" : "Meeting logged");
    setSaving(false);
    if (saved) onClose();
  };

  const Icon = copy.icon;
  return (
    <>
      <SetuDrawer open={open} onClose={onClose} title={copy.title} description={`${deal.company} · ${displayCode(deal)}`} width="max-w-2xl">
          <form onSubmit={submit} noValidate>
            <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
              <Field label="Meeting Title" required className="sm:col-span-2">
                <Input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Architecture & Security Review" className="setu-input h-9" autoFocus />
              </Field>
              <Field label="Meeting Type">
                <Input value={form.type} onChange={(e) => set({ type: e.target.value })} placeholder="e.g. Technical Deep Dive" className="setu-input h-9" />
              </Field>
              <Field label="Channel">
                <Select value={form.channel} onValueChange={(v) => set({ channel: v as MeetingChannel })}>
                  <SelectTrigger className="setu-input !h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {MEETING_CHANNEL_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Date" required>
                <Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className="setu-input h-9" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start (IST)" required>
                  <Input type="time" value={form.start} onChange={(e) => set({ start: e.target.value })} className="setu-input h-9" />
                </Field>
                <Field label="End (IST)" required>
                  <Input type="time" value={form.end} onChange={(e) => set({ end: e.target.value })} className="setu-input h-9" />
                </Field>
              </div>
              {online ? (
                <Field label="Meeting Link">
                  <Input type="url" value={form.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://meet.google.com/…" className="setu-input h-9" />
                </Field>
              ) : (
                <Field label="Location">
                  <Input value={form.location} onChange={(e) => set({ location: e.target.value })} placeholder="Address or room" className="setu-input h-9" />
                </Field>
              )}
              <Field label="Recording Link">
                <Input type="url" value={form.recordingUrl} onChange={(e) => set({ recordingUrl: e.target.value })} placeholder="https://…" className="setu-input h-9" />
              </Field>
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Attendees</span>
                  <button type="button" onClick={() => setExternalOpen(true)} className="setu-accent-text flex cursor-pointer items-center gap-1 text-xs font-semibold hover:underline">
                    <UserPlus size={13} /> Add External Attendee
                  </button>
                </div>
                <AttendeePicker existing={form.attendees} onAdd={addAttendee} exclude={[userName]} />
                <AttendeeChips attendees={form.attendees} onRemove={(id) => set({ attendees: form.attendees.filter((a) => a.id !== id) })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold">
                  Meeting Notes & Discussion Summary <span className="text-red-500">*</span>
                </span>
                <RichDescriptionEditor value={form.summary} onChange={(summary) => set({ summary })} />
              </div>
              {error && <p className="text-xs text-red-500 sm:col-span-2">{error}</p>}
            </div>
            <div className="flex items-center gap-3 border-t border-border px-6 py-4">
              <SetuButton variant="solid" type="submit" className="px-6" disabled={saving}>
                {saving ? "Saving…" : copy.submit}
              </SetuButton>
              <SetuButton variant="secondary" className="px-6" onClick={onClose}>
                Cancel
              </SetuButton>
            </div>
          </form>
      </SetuDrawer>
      <AddExternalAttendeeDialog open={externalOpen} onClose={() => setExternalOpen(false)} onAdd={addAttendee} />
    </>
  );
}

// ── Complete meeting ──────────────────────────────────────────────────────────

/** "Complete Meeting & Log Summary": mark who attended, write the summary, close the meeting. */
export function CompleteMeetingDialog({
  deal,
  meeting,
  number,
  open,
  onClose,
}: {
  deal: Deal;
  meeting?: DealMeeting;
  number: number;
  open: boolean;
  onClose: () => void;
}) {
  const completeMeeting = useSetuStore((s) => s.completeMeeting);
  const [saving, setSaving] = useState(false);
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [externalOpen, setExternalOpen] = useState(false);

  useEffect(() => {
    if (open && meeting) {
      setAttendees(meeting.attendees.map((a) => ({ ...a, attended: a.attended ?? true })));
      setSummary(meeting.summary ?? "");
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meeting?.id]);

  if (!meeting) return null;
  const present = attendees.filter((a) => a.attended).length;
  const day = relativeDay(meeting.startAt, isoDate(new Date()));
  const seconds = (Date.parse(meeting.endAt) - Date.parse(meeting.startAt)) / 1000;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (isEmptyDescription(summary)) return setError("Add the meeting notes & discussion summary.");
    setSaving(true);
    const ok = await attempt(completeMeeting(meeting.id, attendees, summary).then(() => true), "Meeting completed & notes saved");
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <>
      <SetuDrawer
        open={open}
        onClose={onClose}
        title="Complete Meeting & Log Summary"
        badge={<span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">Deal #{displayCode(deal)}</span>}
        description={`Meeting #${number} — ${meeting.title} · ${deal.company}`}
        width="max-w-2xl"
      >
          <form onSubmit={submit} noValidate className="space-y-5 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--setu-line)] bg-[var(--setu-well)]/40 px-4 py-3 text-xs">
              <span className="setu-text-2 flex items-center gap-2">
                <Clock3 size={14} className="setu-accent-text" />
                Session Held:{" "}
                <span className="font-semibold text-[var(--setu-text)]">
                  {day ? `${day} / ` : ""}
                  {formatDate(meeting.startAt)}
                </span>
                · {formatTimeRange(meeting.startAt, meeting.endAt)} ({formatSpan(seconds)})
              </span>
              <span className="setu-text-2 flex items-center gap-1.5 text-xs">
                Channel:
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--setu-accent-soft)] px-2 py-0.5 font-medium text-[var(--setu-text)]">
                  <Video size={12} /> {MEETING_CHANNEL_LABEL[meeting.channel]}
                </span>
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--setu-text)]">Attendees & Participation</h3>
                <span className="setu-text-2 text-xs">{present} marked present</span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {attendees.map((a) => (
                  <label
                    key={a.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-lg border bg-[var(--setu-card)] px-3 py-2.5 transition-colors",
                      a.attended ? "border-[var(--setu-accent-ring)]" : "border-[var(--setu-line)]"
                    )}
                  >
                    <Checkbox
                      checked={Boolean(a.attended)}
                      onCheckedChange={(v) => setAttendees((list) => list.map((x) => (x.id === a.id ? { ...x, attended: v === true } : x)))}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{a.name}</span>
                      <span className="setu-text-2 block truncate text-[11px]">{a.role ?? (a.external ? "Guest" : "Team")}</span>
                    </span>
                    {a.attended && (
                      <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-400">Attended</span>
                    )}
                  </label>
                ))}
              </div>
              <button type="button" onClick={() => setExternalOpen(true)} className="setu-accent-text flex cursor-pointer items-center gap-1 text-xs font-semibold hover:underline">
                <Plus size={13} /> Add Attendee / Guest
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[var(--setu-text)]">
                Meeting Notes & Discussion Summary <span className="text-red-500">*</span>
              </h3>
              <RichDescriptionEditor value={summary} onChange={setSummary} />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex items-center gap-3 border-t border-border pt-4">
              <SetuButton variant="solid" type="submit" className="px-6" disabled={saving}>
                {saving ? "Saving…" : "Complete Meeting & Save Notes"}
              </SetuButton>
              <SetuButton variant="secondary" className="px-6" onClick={onClose}>
                Cancel
              </SetuButton>
            </div>
          </form>
      </SetuDrawer>
      <AddExternalAttendeeDialog
        open={externalOpen}
        onClose={() => setExternalOpen(false)}
        onAdd={(a) => setAttendees((list) => [...list, { ...a, id: attendeeId(), attended: true }])}
      />
    </>
  );
}
