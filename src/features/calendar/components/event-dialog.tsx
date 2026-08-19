"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  MapPin,
  Phone,
  Video,
  Info,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  CheckCircle2,
  Users,
  MessageSquare,
  Plus,
  Sparkles,
  Loader2,
} from "lucide-react";
import { createCalendarEvent, type CreateEventState } from "../actions/create-event";
import { updateCalendarEvent, type UpdateEventState } from "../actions/update-event";
import { ParticipantPicker } from "./participant-picker";
import { EventDateTimePicker } from "./event-date-time-picker";
import { EventDetailPopover } from "./event-detail-popover";
import { RecurrencePicker } from "./recurrence-picker";
import { toDateTimeLocalValue, toTitleCase, validateEventDateTime } from "../utils";
import { localWeekday, withLocalWeekday, type RecurrenceRule } from "../recurrence";
import type { CalendarEventView } from "../queries";

type InternalUser = { id: string; name: string | null; email: string };

type Props = {
  mode: "create" | "edit";
  event?: CalendarEventView;
  defaultStart?: Date;
  defaultTitle?: string;
  defaultParticipantIds?: string[];
  internalUsers: InternalUser[];
  currentUserId: string;
  onClose: () => void;
  onEventCreatedLocally?: (event: CalendarEventView) => void;
  /** Fired once, after the server confirms the event was created/updated. */
  onSaved?: (event: CalendarEventView) => void;
  /** In "create" mode, atomically links the new event back to this support-need row server-side. */
  linkSupportNeedId?: string;
};

const ROOM_OPTIONS = [
  "Conference room 10",
  "Boardroom Alpha",
  "Meeting Room 2B",
  "Executive Suite 404",
  "Design Studio A",
];

export function EventDialog({
  mode,
  event,
  defaultStart,
  defaultTitle,
  defaultParticipantIds,
  internalUsers,
  currentUserId,
  onClose,
  onEventCreatedLocally,
  onSaved,
  linkSupportNeedId,
}: Props) {
  const router = useRouter();
  const [createState, createAction, createPending] = useActionState<CreateEventState, FormData>(
    createCalendarEvent,
    {},
  );
  const [updateState, updateAction, updatePending] = useActionState<UpdateEventState, FormData>(
    updateCalendarEvent,
    {},
  );

  // After a fresh "create", clicking "Edit" on the success confirmation must
  // switch to actually *updating* the just-created event — otherwise
  // resubmitting the form would call createCalendarEvent again and produce a
  // duplicate event.
  const [isEditingAfterSuccess, setIsEditingAfterSuccess] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | undefined>(undefined);
  const effectiveMode: "create" | "edit" = mode === "create" && isEditingAfterSuccess ? "edit" : mode;
  const effectiveEventId = mode === "create" ? createdEventId : event?.id;

  const state = effectiveMode === "create" ? createState : updateState;
  const action = effectiveMode === "create" ? createAction : updateAction;
  const pending = effectiveMode === "create" ? createPending : updatePending;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLoading = pending || isSubmitting;

  useEffect(() => {
    if (state.message || state.errors) {
      const timer = setTimeout(() => setIsSubmitting(false), 0);
      return () => clearTimeout(timer);
    }
  }, [state]);

  // Local Form UI States matching mockups
  const [meetingType, setMeetingType] = useState<"face-to-face" | "online">("online");
  const [title, setTitle] = useState(event?.title ?? defaultTitle ?? "");
  const [start, setStart] = useState<Date>(() => {
    if (event?.start) return event.start;
    if (defaultStart) return defaultStart;
    const d = new Date();
    d.setHours(17, 0, 0, 0);
    return d;
  });
  const [end, setEnd] = useState<Date>(() => {
    if (event?.end) return event.end;
    const s = event?.start ?? defaultStart;
    if (s) return new Date(s.getTime() + 60 * 60 * 1000);
    const d = new Date();
    d.setHours(18, 0, 0, 0);
    return d;
  });
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | null>(event?.recurrenceRule ?? null);

  // Keep the date and a single-weekday WEEKLY rule (e.g. "Weekly on Wednesday")
  // in sync in both directions. Monthly/Yearly rules already derive their
  // day-of-month straight from `start`, so only WEEKLY's explicit `byDay`
  // needs this. Both handlers below update the two states together in one
  // event, rather than reacting to a state change after the fact.

  // Direction A: the date changes (via the date/time picker) — the rule follows to the new weekday.
  function handleStartChange(newStart: Date) {
    setStart(newStart);
    setRecurrenceRule((prev) => {
      if (!prev || prev.freq !== "WEEKLY" || !prev.byDay || prev.byDay.length !== 1) return prev;
      const currentWeekday = localWeekday(newStart);
      if (prev.byDay[0] === currentWeekday) return prev;
      return { ...prev, byDay: [currentWeekday] };
    });
  }

  // Direction B: a different single weekday is picked directly in the recurrence
  // dropdown (Custom → Week tab) — the event's own date moves to that weekday.
  function handleRecurrenceChange(rule: RecurrenceRule | null) {
    if (rule && rule.freq === "WEEKLY" && rule.byDay && rule.byDay.length === 1 && rule.byDay[0] !== localWeekday(start)) {
      const newStart = withLocalWeekday(start, rule.byDay[0]);
      const duration = end.getTime() - start.getTime();
      setStart(newStart);
      setEnd(new Date(newStart.getTime() + duration));
    }
    setRecurrenceRule(rule);
  }

  const [location, setLocation] = useState(
    event?.description?.startsWith("Location: ")
      ? event.description.replace("Location: ", "")
      : "",
  );
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [meetingMode, setMeetingMode] = useState<"audio" | "video">("audio");
  const [isRecording, setIsRecording] = useState(false);

  // Advanced toggles
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(true);
  const [assignToTab, setAssignToTab] = useState<"participants" | "conversation">("participants");
  const [participantEmail, setParticipantEmail] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [alertType, setAlertType] = useState<"none" | "remind" | "zia">("zia");
  const [coHosts, setCoHosts] = useState<string[]>([]);
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [showAddCoHostInput, setShowAddCoHostInput] = useState(false);
  const [showAddSpeakerInput, setShowAddSpeakerInput] = useState(false);
  const [tempCoHost, setTempCoHost] = useState("");
  const [tempSpeaker, setTempSpeaker] = useState("");

  const initialParticipantIds = defaultParticipantIds && defaultParticipantIds.length > 0
    ? defaultParticipantIds
    : internalUsers
      .filter((u) => event?.attendees.some((a) => a.email === u.email))
      .map((u) => u.id);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialParticipantIds);

  const currentUser = internalUsers.find((u) => u.id === currentUserId);
  const userName = currentUser?.name || currentUser?.email || "mohit.thakre";

  // Ticking clock so "Start time must be in the future" / disabled quick options
  // stay accurate even if the dialog is left open for a while.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Only newly-created events must start in the future — editing an existing
  // (possibly already-past) event shouldn't be blocked by this.
  const dtErrors = effectiveMode === "create" ? validateEventDateTime(start, end, now) : {};
  const isDateTimeValid = !dtErrors.start && !dtErrors.end;

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!isDateTimeValid) {
      e.preventDefault();
      return;
    }

    setIsSubmitting(true);

    const selectedUsers = internalUsers.filter((u) => selectedIds.includes(u.id));
    const attendeeEmails = new Set<string>();
    selectedUsers.forEach((u) => attendeeEmails.add(u.email));
    if (participantEmail) attendeeEmails.add(participantEmail.trim());

    const attendeesList = [
      { email: currentUser?.email ?? "mohit.thakre@zylker.com", status: "ACCEPTED" },
      ...Array.from(attendeeEmails)
        .filter((e) => e !== currentUser?.email)
        .map((email) => ({ email, status: "NEEDS_ACTION" })),
    ];

    const newEvt: CalendarEventView = {
      id: event?.id ?? `local-evt-${Date.now()}`,
      etag: Date.now(),
      title: toTitleCase(title) || "Scheduled Event",
      description: meetingType === "online" ? `Online Meeting (${meetingMode.toUpperCase()})` : `Location: ${location}`,
      start: new Date(start),
      end: new Date(end),
      isAllDay: false,
      organizerEmail: currentUser?.email ?? "mohit.thakre@zylker.com",
      attendees: attendeesList,
      recurrenceRule,
    };

    if (onEventCreatedLocally) {
      onEventCreatedLocally(newEvt);
    }
  }

  const successMessage = effectiveMode === "create" ? "created" : "updated";

  const onSavedFiredRef = useRef(false);
  useEffect(() => {
    if (state.message !== successMessage) {
      onSavedFiredRef.current = false;
      return;
    }
    if (onSavedFiredRef.current) return;
    onSavedFiredRef.current = true;

    const selectedUsers = internalUsers.filter((u) => selectedIds.includes(u.id));
    const attendeeEmails = new Set<string>();
    selectedUsers.forEach((u) => attendeeEmails.add(u.email));
    if (participantEmail) attendeeEmails.add(participantEmail.trim());
    const userEmail = currentUser?.email ?? "mohit.thakre@zylker.com";

    onSaved?.({
      id: state.eventId || effectiveEventId || event?.id || `local-evt-${Date.now()}`,
      etag: Date.now(),
      title: toTitleCase(title) || "Scheduled Event",
      description: location ? `Location: ${location}` : meetingType === "online" ? `Online Meeting` : "",
      start: new Date(start),
      end: new Date(end),
      isAllDay: false,
      organizerEmail: userEmail,
      attendees: [
        { email: userEmail, status: "ACCEPTED" },
        ...Array.from(attendeeEmails)
          .filter((e) => e.toLowerCase() !== userEmail.toLowerCase())
          .map((email) => ({ email, status: "NEEDS_ACTION" })),
      ],
      recurrenceRule,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.message]);

  if (state.message === successMessage) {
    const selectedUsers = internalUsers.filter((u) => selectedIds.includes(u.id));
    const attendeeEmails = new Set<string>();
    selectedUsers.forEach((u) => attendeeEmails.add(u.email));
    if (participantEmail) attendeeEmails.add(participantEmail.trim());

    const userEmail = currentUser?.email ?? "mohit.thakre@zylker.com";
    const attendeesList = [
      { email: userEmail, status: "ACCEPTED" },
      ...Array.from(attendeeEmails)
        .filter((e) => e.toLowerCase() !== userEmail.toLowerCase())
        .map((email) => ({ email, status: "NEEDS_ACTION" })),
    ];

    const createdEventView: CalendarEventView = {
      id: state.eventId || effectiveEventId || event?.id || "local-evt-created",
      etag: 1,
      title: toTitleCase(title) || "Scheduled Event",
      description: location ? `Location: ${location}` : meetingType === "online" ? `Online Meeting` : "",
      start: new Date(start),
      end: new Date(end),
      isAllDay: false,
      organizerEmail: userEmail,
      attendees: attendeesList,
      recurrenceRule,
    };

    return (
      <EventDetailPopover
        event={createdEventView}
        currentUserEmail={userEmail}
        onClose={() => {
          router.refresh();
          onClose();
        }}
        onEdit={() => {
          setCreatedEventId(state.eventId || effectiveEventId);
          setIsEditingAfterSuccess(true);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-overlay backdrop-blur-xs animate-in fade-in duration-200">
      {/* Slide-over Drawer Panel */}
      <div className="w-full max-w-xl h-full border-l border-border bg-card text-card-foreground shadow-2xl flex flex-col overflow-hidden">

        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>All Events</span>
            <span>&gt;</span>
            <span className="font-semibold text-foreground">
              {effectiveMode === "create" ? "Create Event" : "Edit Event"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Profile Pill */}
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="font-medium truncate max-w-[140px]">{userName}</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form
          action={action}
          onSubmit={handleFormSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm"
        >
          <input type="hidden" name="start" value={toDateTimeLocalValue(start)} />
          <input type="hidden" name="end" value={toDateTimeLocalValue(end)} />
          <input type="hidden" name="meetingType" value={meetingType} />
          <input type="hidden" name="meetingMode" value={meetingMode} />
          <input type="hidden" name="meetingLink" value={meetingLink} />
          <input type="hidden" name="alertType" value={alertType} />
          <input type="hidden" name="isRecording" value={String(isRecording)} />
          <input type="hidden" name="participantEmail" value={participantEmail} />
          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="participantIds" value={id} />
          ))}

          {effectiveMode === "edit" && effectiveEventId && (
            <>
              <input type="hidden" name="eventId" value={effectiveEventId} />
              <input type="hidden" name="etag" value={event?.etag ?? 1} />
              {initialParticipantIds.map((id) => (
                <input key={id} type="hidden" name="previousParticipantIds" value={id} />
              ))}
            </>
          )}

          {effectiveMode === "create" && linkSupportNeedId && (
            <input type="hidden" name="supportNeedId" value={linkSupportNeedId} />
          )}

          {/* Meeting Type Selector (Face to Face vs Online Meeting) */}
          {/* <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMeetingType("face-to-face")}
                className={`flex items-center justify-center gap-2.5 rounded-xl border py-3 px-4 text-xs font-semibold transition-all ${meetingType === "face-to-face"
                  ? "border-primary bg-primary/10 text-primary shadow-xs"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
              >
                <MapPin size={16} />
                <span>Face to Face Meeting</span>
              </button>

              <button
                type="button"
                onClick={() => setMeetingType("online")}
                className={`flex items-center justify-center gap-2.5 rounded-xl border py-3 px-4 text-xs font-semibold transition-all ${meetingType === "online"
                  ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/40"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
              >
                <Phone size={16} />
                <span>Online Meeting</span>
              </button>
            </div>
            {meetingType === "online" && (
              <p className="text-center text-xs text-muted-foreground pt-1">
                Real-time interaction between remotely located users.
              </p>
            )}
          </div> */}

          {/* Title / Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Zylker Marketing Openhouse"
              required
              className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
            {state.errors?.title && (
              <p className="text-xs text-destructive">{state.errors.title[0]}</p>
            )}
          </div>

          {/* Date & Time */}
          <EventDateTimePicker
            start={start}
            end={end}
            onStartChange={handleStartChange}
            onEndChange={setEnd}
            now={now}
            startError={dtErrors.start ?? state.errors?.start?.[0]}
            endError={dtErrors.end ?? state.errors?.end?.[0]}
          />

          {/* Recurrence */}
          <RecurrencePicker value={recurrenceRule} onChange={handleRecurrenceChange} start={start} />

          {/* Location / Room */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">
              Location
            </label>
            <input
              type="text"
              name="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Conference room 10"
              className="w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            {/* <div className="relative">
              <button
                type="button"
                onClick={() => setShowRoomPicker(!showRoomPicker)}
                className="text-xs font-medium text-primary hover:underline transition-colors"
              >
                +Select Room
              </button>

              {showRoomPicker && (
                <div className="absolute left-0 top-6 z-20 w-60 rounded-xl border border-border bg-popover p-2 shadow-xl text-popover-foreground">
                  <p className="text-[11px] font-semibold text-muted-foreground px-2 py-1">Select Available Room</p>
                  {ROOM_OPTIONS.map((rm) => (
                    <button
                      key={rm}
                      type="button"
                      onClick={() => {
                        setLocation(rm);
                        setShowRoomPicker(false);
                      }}
                      className="w-full text-left rounded-lg px-2 py-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      {rm}
                    </button>
                  ))}
                </div>
              )}
            </div> */}
          </div>

          {/* Meeting Mode (Audio vs Video + Record option) */}


          {/* Advanced Section Toggle */}
          <div className="border-t border-border pt-4 space-y-4">
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="flex items-center justify-between w-full text-xs font-semibold text-primary hover:underline"
            >
              <span>Advanced</span>
              {isAdvancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {isAdvancedOpen && (
              <div className="space-y-4 bg-muted/20 p-4 rounded-xl border border-border animate-in fade-in duration-150">
                {/* Assign to: Participants | Conversation */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-foreground">
                    Assign to
                  </label>
                  <div className="flex items-center gap-4 text-xs border-b border-border pb-2">
                    <button
                      type="button"
                      onClick={() => setAssignToTab("participants")}
                      className={`font-semibold transition-colors pb-1 border-b-2 ${assignToTab === "participants"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      Participants
                    </button>
                    {/* <button
                      type="button"
                      onClick={() => setAssignToTab("conversation")}
                      className={`font-semibold transition-colors pb-1 border-b-2 ${assignToTab === "conversation"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      Conversation
                    </button> */}
                  </div>

                  {assignToTab === "participants" ? (
                    <div className="space-y-2 pt-1">
                      {/* <input
                        type="email"
                        value={participantEmail}
                        onChange={(e) => setParticipantEmail(e.target.value)}
                        placeholder="scott.fisher@eagleeyedigital.com"
                        className="w-full rounded-lg border border-input bg-background px-3.5 py-2 text-xs text-foreground outline-none focus:border-primary"
                      /> */}
                      <ParticipantPicker
                        users={internalUsers}
                        currentUserId={currentUserId}
                        selectedIds={selectedIds}
                        onChange={setSelectedIds}
                      />
                    </div>
                  ) : (
                    <div className="pt-1">
                      <input
                        type="text"
                        placeholder="Select channel or group conversation..."
                        className="w-full rounded-lg border border-input bg-background px-3.5 py-2 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>
                  )}
                </div>

                {/* Link input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">
                    Link
                  </label>
                  <input
                    type="url"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    placeholder="Enter the URL to be shared with the participants."
                    className="w-full rounded-lg border border-input bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary"
                  />
                </div>

                {/* Alert Type */}
                {/* <div className="space-y-2">
                  <label className="block text-xs font-medium text-foreground">
                    Alert Type
                  </label>
                  <div className="flex items-center gap-5 text-xs text-foreground">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="alertType"
                        checked={alertType === "none"}
                        onChange={() => setAlertType("none")}
                        className="text-primary bg-background border-input focus:ring-primary"
                      />
                      <span>None</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="alertType"
                        checked={alertType === "remind"}
                        onChange={() => setAlertType("remind")}
                        className="text-primary bg-background border-input focus:ring-primary"
                      />
                      <span>Remind me</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="alertType"
                        checked={alertType === "zia"}
                        onChange={() => setAlertType("zia")}
                        className="text-primary bg-background border-input focus:ring-primary"
                      />
                      <span className="flex items-center gap-1 font-medium">
                        Include Zia in your event
                      </span>
                    </label>
                  </div>
                </div> */}
              </div>
            )}
          </div>

          {state.message && state.message !== successMessage && (
            <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
              {state.message}
            </p>
          )}

          {/* Action Footer */}
          <div className="sticky bottom-0 bg-card border-t border-border -mx-6 -mb-5 px-6 py-4 flex items-center justify-between">
            {/* <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>Advanced</span>
              {isAdvancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button> */}

            <div className="flex items-center gap-3 mb-[-24px]">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="rounded-full border border-border px-5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !isDateTimeValid}
                title={!isDateTimeValid ? "Fix the date/time errors above before creating this event" : undefined}
                className="flex items-center gap-1.5 rounded-full bg-primary px-6 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
              >
                {isLoading && <Loader2 size={13} className="animate-spin" />}
                {isLoading ? (effectiveMode === "create" ? "Creating…" : "Saving…") : effectiveMode === "create" ? "Create" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}


