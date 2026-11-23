"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlarmClock,
  ArrowRight,
  BadgeCheck,
  Bookmark,
  Building2,
  CalendarDays,
  CalendarPlus,
  Check,
  Clipboard,
  Clock3,
  Globe,
  Info,
  Link2,
  ListOrdered,
  Lock,
  MapPin,
  Plus,
  ScanEye,
  TriangleAlert,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichDescriptionEditor } from "@/components/shared/rich-description";
import { useClearPageDraft, usePageDraft } from "@/lib/navigation/use-url-state";
import { MEETING_MODES, MEETING_REMINDER_LABEL, STAGE_BY_ID, channelFromLink, modeOfChannel, type MeetingMode } from "../../constants";
import { useSetuStore } from "../../provider";
import type { DealMeeting, MeetingAttendee, MeetingChannel, MeetingReminder } from "../../types";
import { avatarColor, dealTitle, findConflicts, formatDate, formatSpan, formatTimeRange, initials, isoDate, istDateTime, istHhmm } from "../../utils";
import { AddExternalAttendeeDialog, AttendeePicker, ReminderSelect, attendeeId } from "../deal/meeting-attendees";
import { Breadcrumbs, ComingSoon, SetuButton, SetuPage, attempt, useSetuUserName } from "../setu-ui";

interface SchedulerForm {
  title: string;
  dealId: string;
  mode: MeetingMode;
  link: string;
  location: string;
  date: string;
  start: string;
  end: string;
  attendees: MeetingAttendee[];
  agenda: string;
  reminder: MeetingReminder;
}

function initialForm(meeting: DealMeeting | undefined, dealId: string): SchedulerForm {
  if (meeting) {
    return {
      title: meeting.title,
      dealId: meeting.dealId,
      mode: modeOfChannel(meeting.channel),
      link: meeting.link ?? "",
      location: meeting.location ?? "",
      date: isoDate(meeting.startAt),
      start: istHhmm(meeting.startAt),
      end: istHhmm(meeting.endAt),
      attendees: meeting.attendees,
      agenda: meeting.agenda,
      reminder: meeting.reminder,
    };
  }
  return { title: "", dealId, mode: "ONLINE", link: "", location: "", date: isoDate(new Date()), start: "11:00", end: "12:00", attendees: [], agenda: "", reminder: "30m" };
}

const minutesBetween = (start: string, end: string) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
};

/** Schedule a new meeting, or (with `meetingId`) edit / reschedule / finish a draft. */
export function MeetingScheduler({ meetingId }: { meetingId?: string }) {
  const meeting = useSetuStore((s) => (meetingId ? s.meetings.find((m) => m.id === meetingId) : undefined));
  if (meetingId && !meeting) {
    return (
      <SetuPage>
        <Breadcrumbs items={[{ label: "Sales" }, { label: "Activities" }, { label: "Meetings", href: ROUTES.setuMeetings }, { label: "Not found" }]} />
        <ComingSoon title="Meeting not found" text="This meeting doesn't exist (design-phase data resets when the page is refreshed)." />
      </SetuPage>
    );
  }
  if (meeting && (meeting.status === "COMPLETED" || meeting.status === "CANCELLED")) {
    return (
      <SetuPage>
        <Breadcrumbs items={[{ label: "Sales" }, { label: "Activities" }, { label: "Meetings", href: ROUTES.setuMeetings }, { label: meeting.title }]} />
        <ComingSoon
          title={`This meeting is ${meeting.status === "COMPLETED" ? "completed" : "cancelled"}`}
          text="Completed meetings are edited from the deal's Meetings tab (Edit details & summary). Cancelled meetings can't be rescheduled — schedule a new one."
        />
        <div className="flex justify-center">
          <SetuButton variant="primary" asChild>
            <Link href={ROUTES.setuMeeting(meeting.id)}>View meeting</Link>
          </SetuButton>
        </div>
      </SetuPage>
    );
  }
  return <SchedulerBody meeting={meeting} />;
}

function SchedulerBody({ meeting }: { meeting?: DealMeeting }) {
  const router = useRouter();
  const params = useSearchParams();
  const userName = useSetuUserName();
  const deals = useSetuStore((s) => s.deals);
  const meetings = useSetuStore((s) => s.meetings);
  const addMeeting = useSetuStore((s) => s.addMeeting);
  const updateMeeting = useSetuStore((s) => s.updateMeeting);
  const presetDeal = params.get("deal") ?? "";
  const [initial] = useState(() => initialForm(meeting, deals.some((d) => d.id === presetDeal) ? presetDeal : ""));
  const [form, setForm] = usePageDraft<SchedulerForm>("setu-meeting", "form", initial);
  const clearDraft = useClearPageDraft("setu-meeting");
  const [error, setError] = useState("");
  const [externalOpen, setExternalOpen] = useState(false);
  const set = (patch: Partial<SchedulerForm>) => setForm((f) => ({ ...f, ...patch }));

  const hostName = meeting?.hostName ?? userName;
  const hostRole = meeting?.hostRole;
  const editing = Boolean(meeting && meeting.status === "UPCOMING");
  const deal = deals.find((d) => d.id === form.dealId);
  const external = form.attendees.filter((a) => a.external);
  const internal = form.attendees.filter((a) => !a.external);
  const mins = minutesBetween(form.start, form.end);
  const validSlot = Boolean(form.date && form.start && form.end && mins > 0);
  const startAt = validSlot ? istDateTime(form.date, form.start) : "";
  const endAt = validSlot ? istDateTime(form.date, form.end) : "";
  const conflicts = validSlot ? findConflicts(meetings, { id: meeting?.id, startAt, endAt, hostName, attendees: form.attendees }) : [];
  const channel: MeetingChannel = form.mode === "ONLINE" ? channelFromLink(form.link) : form.mode;
  const back = meeting ? ROUTES.setuMeeting(meeting.id) : presetDeal ? `${ROUTES.setuDeal(presetDeal)}?tab=meetings` : ROUTES.setuMeetings;

  const addAttendee = (a: Omit<MeetingAttendee, "id">) => setForm((f) => ({ ...f, attendees: [...f.attendees, { ...a, id: attendeeId() }] }));
  const removeAttendee = (id: string) => setForm((f) => ({ ...f, attendees: f.attendees.filter((a) => a.id !== id) }));

  const pickDeal = (dealId: string) => {
    const d = deals.find((x) => x.id === dealId);
    setForm((f) => {
      // Picking a deal adds its decision maker as the first external participant.
      const hasContact = d && f.attendees.some((a) => a.name.toLowerCase() === d.contactName.toLowerCase());
      const contact: MeetingAttendee[] =
        d && d.contactName && !hasContact
          ? [{ id: attendeeId(), name: d.contactName, role: d.contactRole || undefined, email: d.email || undefined, company: d.company, external: true, source: d.stage === "LEAD" ? "LEAD" : "DEAL", rsvp: "PENDING" }]
          : [];
      return { ...f, dealId, attendees: [...contact, ...f.attendees] };
    });
  };

  const pasteLink = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!/^https?:\/\//i.test(text)) return toast.error("Clipboard doesn't contain a link");
      set({ link: text });
    } catch {
      toast.error("Couldn't read the clipboard — paste with Ctrl+V");
    }
  };

  const [saving, setSaving] = useState(false);

  const save = async (asDraft: boolean) => {
    if (saving) return;
    const problem = !form.title.trim()
      ? "Meeting title is required."
      : !form.dealId
        ? "Pick the related lead / deal."
        : asDraft
          ? ""
          : !validSlot
            ? "Pick a date and an end time after the start time."
            : form.mode === "ONLINE" && form.link.trim() && !/^https?:\/\//i.test(form.link.trim())
              ? "The meeting link must start with http(s)://"
              : form.mode !== "ONLINE" && !form.location.trim()
                ? "Add the meeting location."
                : "";
    setError(problem);
    if (problem) return;

    const slotOk = validSlot;
    const data = {
      title: form.title.trim(),
      type: meeting?.type ?? (form.mode === "ONLINE" ? "Online Meeting" : form.mode === "IN_OFFICE" ? "In-office Meeting" : "On-site Consultation"),
      startAt: slotOk ? startAt : istDateTime(form.date || isoDate(new Date()), form.start || "11:00"),
      endAt: slotOk ? endAt : istDateTime(form.date || isoDate(new Date()), form.start || "11:00"),
      channel,
      link: form.mode === "ONLINE" ? form.link.trim() || undefined : undefined,
      location: form.mode === "ONLINE" ? undefined : form.location.trim() || undefined,
      agenda: form.agenda,
      attendees: form.attendees,
      reminder: form.reminder,
    };

    const status = asDraft ? "DRAFT" : "UPCOMING";
    setSaving(true);
    const saved = await attempt(
      meeting ? updateMeeting(meeting.id, data, status) : addMeeting(form.dealId, { ...data, hostRole }, status),
      asDraft ? "Saved as draft" : editing ? "Meeting updated" : "Meeting scheduled"
    );
    setSaving(false);
    if (!saved) return;
    clearDraft();
    router.push(ROUTES.setuMeeting(saved.id));
  };

  const cancel = () => {
    clearDraft();
    router.push(back);
  };

  const title = editing ? "Edit Meeting" : "Schedule Meeting";

  return (
    <SetuPage className="pb-0">
      <Breadcrumbs items={[{ label: "Sales" }, { label: "Activities" }, { label: "Meetings", href: ROUTES.setuMeetings }, { label: title }]} />

      <section className="setu-card flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--setu-accent)] text-[var(--setu-accent-ink)]">
            <CalendarPlus size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight">{title}</h1>
            <p className="setu-text-2 text-sm">Create a meeting with your customer, prospect or sales team.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SetuButton className="bg-[var(--setu-soft)]" onClick={cancel}>
            Cancel
          </SetuButton>
          {!editing && (
            <SetuButton onClick={() => save(true)} disabled={saving}>
              <Bookmark /> Save as Draft
            </SetuButton>
          )}
          <SetuButton variant="primary" onClick={() => save(false)} disabled={saving}>
            {editing ? <Check /> : <Plus />} {editing ? "Save Changes" : "Schedule Meeting"}
          </SetuButton>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {/* Meeting information */}
          <section className="setu-card space-y-5 px-6 py-5">
            <CardTitle icon={CalendarDays} title="Meeting Information" chip="Core Setup" />
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold">
                Meeting Title <span className="text-red-500">*</span>
              </span>
              <Input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Client Requirement Discussion" className="setu-input h-10 text-sm" />
            </label>
            <div className="block space-y-1.5">
              <span className="text-xs font-semibold">
                Related Lead / Deal <span className="text-red-500">*</span>
              </span>
              <Select value={form.dealId || undefined} onValueChange={pickDeal} disabled={Boolean(meeting)}>
                <SelectTrigger className="setu-input !h-10 w-full text-sm">
                  <SelectValue placeholder="Pick the lead or deal this meeting is for" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {deals.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.company} — {dealTitle(d)} · {STAGE_BY_ID[d.stage].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold">
                Meeting Type <span className="text-red-500">*</span>
              </span>
              <div className="grid gap-3 sm:grid-cols-3">
                {MEETING_MODES.map((mo) => {
                  const active = form.mode === mo.id;
                  const Icon = mo.id === "ONLINE" ? Video : mo.id === "IN_OFFICE" ? Building2 : MapPin;
                  return (
                    <button
                      key={mo.id}
                      type="button"
                      onClick={() => set({ mode: mo.id })}
                      aria-pressed={active}
                      className={cn(
                        "relative cursor-pointer rounded-xl border px-4 py-3.5 text-left transition-colors",
                        active ? "border-[var(--setu-accent)] bg-[var(--setu-accent-soft)]" : "border-[var(--setu-line)] bg-[var(--setu-soft)] hover:border-[var(--setu-line-strong)]"
                      )}
                    >
                      <Icon size={20} className={active ? "setu-accent-text" : "setu-text-2"} />
                      <span
                        className={cn(
                          "absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full",
                          active ? "bg-[var(--setu-accent)] text-[var(--setu-accent-ink)]" : "bg-[var(--setu-line)]"
                        )}
                      >
                        {active && <Check size={12} />}
                      </span>
                      <p className={cn("mt-3 text-sm font-semibold", active && "setu-accent-text")}>{mo.label}</p>
                      <p className="setu-text-2 text-xs">{mo.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {form.mode === "ONLINE" ? (
              <div className="rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)] p-4">
                <p className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--setu-card)] text-[var(--setu-accent)]">
                    <Link2 size={15} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">External Meeting Link</span>
                    <span className="setu-text-2 block text-xs">Attach your video conference URL (Google Meet, Zoom or Teams)</span>
                  </span>
                </p>
                <div className="mt-3 flex gap-2">
                  <div className="relative flex-1">
                    <Video size={15} className="setu-text-3 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input type="url" value={form.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://meet.google.com/…" className="setu-input h-9 bg-[var(--setu-card)]! pl-9 font-mono text-xs" />
                  </div>
                  <SetuButton onClick={pasteLink} className="h-9">
                    <Clipboard /> Paste Link
                  </SetuButton>
                </div>
              </div>
            ) : (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold">
                  {form.mode === "IN_OFFICE" ? "Office / Room" : "Client Address"} <span className="text-red-500">*</span>
                </span>
                <div className="relative">
                  <MapPin size={15} className="setu-text-3 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={form.location}
                    onChange={(e) => set({ location: e.target.value })}
                    placeholder={form.mode === "IN_OFFICE" ? "e.g. WinOS HQ · Room 3" : "e.g. ABC Technologies, Pune campus"}
                    className="setu-input h-9 pl-9"
                  />
                </div>
              </label>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold">
                  Date <span className="text-red-500">*</span>
                </span>
                <Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className="setu-input h-9" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold">
                  Start Time <span className="text-red-500">*</span>
                </span>
                <Input type="time" value={form.start} onChange={(e) => set({ start: e.target.value })} className="setu-input h-9" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold">
                  End Time{mins > 0 && ` (${formatSpan(mins * 60)})`} <span className="text-red-500">*</span>
                </span>
                <Input type="time" value={form.end} onChange={(e) => set({ end: e.target.value })} className="setu-input h-9" />
              </label>
            </div>
            <p className="setu-text-2 flex items-center gap-1.5 text-xs">
              <Globe size={13} /> Timezone: <span className="font-semibold text-[var(--setu-text)]">IST (India Standard Time, UTC+5:30)</span>
            </p>
          </section>

          {/* Participants */}
          <section className="setu-card space-y-4 px-6 py-5">
            <div className="flex items-center justify-between">
              <CardTitle icon={Users} title="Participants" />
              <span className="setu-text-2 rounded-md bg-[var(--setu-well)] px-2 py-0.5 text-xs font-semibold">{form.attendees.length + 1} Invited</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider">External Participants (Lead / Prospect)</h3>
              <button type="button" onClick={() => setExternalOpen(true)} className="setu-accent-text flex cursor-pointer items-center gap-1 text-xs font-semibold hover:underline">
                <UserPlus size={13} /> Add Another External Attendee
              </button>
            </div>
            <AttendeePicker scope="external" existing={form.attendees} onAdd={addAttendee} placeholder="Search leads, contacts or companies…" />
            <div className="space-y-2">
              {external.length === 0 && <p className="setu-text-3 text-xs">No external participants yet.</p>}
              {external.map((a) => (
                <PersonRow
                  key={a.id}
                  name={a.name}
                  badge={a.source === "LEAD" ? "Lead" : "External Attendee"}
                  sub={[a.company, a.email].filter(Boolean).join(" • ")}
                  onRemove={() => removeAttendee(a.id)}
                  large
                />
              ))}
            </div>

            <h3 className="border-t border-[var(--setu-line)] pt-4 text-xs font-bold uppercase tracking-wider">Internal Participants (WinOS Sales & Account Team)</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <PersonRow name={hostName} badge="Host" sub={hostRole ?? "Organizer"} locked />
              {internal.map((a) => (
                <PersonRow key={a.id} name={a.name} sub={[a.role, a.email].filter(Boolean).join(" • ") || "Team"} onRemove={() => removeAttendee(a.id)} />
              ))}
            </div>
            <AttendeePicker scope="team" existing={form.attendees} exclude={[hostName]} onAdd={addAttendee} placeholder="Add WinOS team member by name or role…" />
          </section>

          {/* Agenda */}
          <section className="setu-card space-y-4 px-6 py-5">
            <CardTitle icon={ListOrdered} title="Agenda & Discussion Points" />
            <RichDescriptionEditor value={form.agenda} onChange={(agenda) => set({ agenda })} />
          </section>

          {/* Reminders */}
          <section className="setu-card space-y-4 px-6 py-5">
            <CardTitle icon={AlarmClock} title="Reminders & Notifications" />
            <div className="max-w-sm space-y-1.5">
              <span className="text-xs font-semibold">Default Reminder</span>
              <ReminderSelect value={form.reminder} onChange={(reminder) => set({ reminder })} />
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="setu-card space-y-4 px-5 py-5 lg:sticky lg:top-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ScanEye size={18} className="setu-accent-text" /> Meeting Summary
            </h2>
            <span className="rounded-md bg-[var(--setu-accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--setu-accent)]">Live Preview</span>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-blue-700 to-blue-500 p-4 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">Scheduled Slot</p>
            {validSlot ? (
              <>
                <p className="mt-1 text-2xl font-bold">{formatDate(form.date)}</p>
                <p className="text-sm text-white/90">
                  {formatTimeRange(startAt, endAt)} ({formatSpan(mins * 60)})
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm">Pick a date and time</p>
            )}
            <p className="mt-3 flex items-center gap-1.5 border-t border-white/20 pt-2 text-xs">
              {form.mode === "ONLINE" ? <Video size={13} /> : <MapPin size={13} />}
              {form.mode === "ONLINE" ? "Virtual Meeting" : form.location || (form.mode === "IN_OFFICE" ? "In-office" : "Client location")}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">Attendees</span>
              <span className="setu-text-2 text-xs">
                {external.length} External • {internal.length + 1} Internal
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3 rounded-xl bg-[var(--setu-well)] px-3 py-3">
              <div className="flex -space-x-2">
                {[hostName, ...form.attendees.map((a) => a.name)].slice(0, 4).map((n) => (
                  <span key={n} className={cn("flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-[var(--setu-card)]", avatarColor(n))}>
                    {initials(n)}
                  </span>
                ))}
              </div>
              <p className="min-w-0 truncate text-xs font-medium">{[hostName, ...form.attendees.map((a) => a.name)].join(", ")}</p>
            </div>
          </div>

          {conflicts.length === 0 ? (
            <div className="flex gap-3 rounded-xl bg-[var(--setu-well)] px-3 py-3">
              <BadgeCheck size={18} className="mt-0.5 shrink-0 text-green-600" />
              <div className="text-xs">
                <p className="text-xs font-semibold">Availability Confirmed</p>
                <p className="setu-text-2">No overlapping Setu meetings for {[hostName, ...internal.map((a) => a.name)].join(", ")}.</p>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="text-xs">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Scheduling conflict</p>
                {conflicts.map((c) => (
                  <p key={c.meeting.id} className="text-amber-800/90 dark:text-amber-200/90">
                    {c.people.join(", ")} {c.people.length > 1 ? "are" : "is"} in “{c.meeting.title}” ({formatTimeRange(c.meeting.startAt, c.meeting.endAt)}).
                  </p>
                ))}
              </div>
            </div>
          )}

          <p className="setu-text-2 flex items-start gap-1.5 text-xs">
            <Info size={13} className="mt-0.5 shrink-0" /> Email reminder {MEETING_REMINDER_LABEL[form.reminder].toLowerCase()} the meeting.
          </p>
          {deal && (
            <p className="setu-text-2 flex items-start gap-1.5 text-xs">
              <Clock3 size={13} className="mt-0.5 shrink-0" /> For {deal.company} · {dealTitle(deal)}
            </p>
          )}
        </aside>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-2 border-t border-[var(--setu-line)] bg-[var(--setu-card)]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="setu-text-2 flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full bg-[var(--setu-accent)]" />
            <span className="font-semibold text-[var(--setu-text)]">Draft auto-saved</span> · kept until you schedule, save or discard
          </p>
          {error && <p className="text-xs font-medium text-red-500">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <SetuButton className="bg-[var(--setu-soft)]" onClick={cancel}>
              <X /> Discard / Cancel
            </SetuButton>
            {!editing && (
              <SetuButton className="bg-[var(--setu-soft)]" onClick={() => save(true)} disabled={saving}>
                Save as Draft
              </SetuButton>
            )}
            <SetuButton variant="primary" onClick={() => save(false)} className="px-5" disabled={saving}>
              {editing ? "Save Changes" : "Schedule Meeting"} <ArrowRight />
            </SetuButton>
          </div>
        </div>
      </div>

      <AddExternalAttendeeDialog open={externalOpen} onClose={() => setExternalOpen(false)} onAdd={addAttendee} />
    </SetuPage>
  );
}

function CardTitle({ icon: Icon, title, chip }: { icon: React.ElementType; title: string; chip?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Icon size={20} className="setu-accent-text" /> {title}
      </h2>
      {chip && <span className="rounded-md bg-[var(--setu-accent-soft)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--setu-accent)]">{chip}</span>}
    </div>
  );
}

function PersonRow({
  name,
  badge,
  sub,
  onRemove,
  locked,
  large,
}: {
  name: string;
  badge?: string;
  sub: string;
  onRemove?: () => void;
  locked?: boolean;
  large?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl bg-[var(--setu-well)] px-3", large ? "py-3" : "py-2.5")}>
      <span className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold text-white", avatarColor(name), large ? "h-10 w-10 text-sm" : "h-9 w-9 text-xs")}>
        {initials(name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className={cn("font-semibold", large ? "text-base" : "text-sm")}>{name}</span>
          {badge && <span className="rounded bg-violet-100 px-1.5 py-px text-[10px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">{badge}</span>}
        </p>
        <p className="setu-text-2 truncate text-xs">{sub}</p>
      </div>
      {locked ? (
        <Lock size={15} className="setu-accent-text shrink-0" aria-label="Host can't be removed" />
      ) : (
        onRemove && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${name}`} className="setu-text-3 cursor-pointer rounded-md p-1 hover:text-[var(--setu-text)]">
            <X size={16} />
          </button>
        )
      )}
    </div>
  );
}
