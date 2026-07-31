"use client";

import { useActionState, useState } from "react";
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
} from "lucide-react";
import { createCalendarEvent, type CreateEventState } from "../actions/create-event";
import { updateCalendarEvent, type UpdateEventState } from "../actions/update-event";
import { ParticipantPicker } from "./participant-picker";
import { toDateTimeLocalValue } from "../utils";
import type { CalendarEventView } from "../queries";

type InternalUser = { id: string; name: string | null; email: string };

type Props = {
  mode: "create" | "edit";
  event?: CalendarEventView;
  defaultStart?: Date;
  internalUsers: InternalUser[];
  currentUserId: string;
  onClose: () => void;
  onEventCreatedLocally?: (event: CalendarEventView) => void;
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
  internalUsers,
  currentUserId,
  onClose,
  onEventCreatedLocally,
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

  const state = mode === "create" ? createState : updateState;
  const action = mode === "create" ? createAction : updateAction;
  const pending = mode === "create" ? createPending : updatePending;

  // Local Form UI States matching mockups
  const [meetingType, setMeetingType] = useState<"face-to-face" | "online">("online");
  const [title, setTitle] = useState(event?.title ?? (mode === "create" ? "Zylker Marketing Openhouse" : ""));
  const [start, setStart] = useState<Date>(event?.start ?? defaultStart ?? new Date());
  const [end, setEnd] = useState<Date>(
    event?.end ?? new Date((event?.start ?? defaultStart ?? new Date()).getTime() + 60 * 60 * 1000),
  );
  const [repeatEvent, setRepeatEvent] = useState(false);
  const [location, setLocation] = useState("Conference room 10");
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [meetingMode, setMeetingMode] = useState<"audio" | "video">("audio");
  const [isRecording, setIsRecording] = useState(false);

  // Advanced toggles
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(true);
  const [assignToTab, setAssignToTab] = useState<"participants" | "conversation">("participants");
  const [participantEmail, setParticipantEmail] = useState("scott.fisher@zylker.com");
  const [meetingLink, setMeetingLink] = useState("");
  const [alertType, setAlertType] = useState<"none" | "remind" | "zia">("zia");
  const [coHosts, setCoHosts] = useState<string[]>([]);
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [showAddCoHostInput, setShowAddCoHostInput] = useState(false);
  const [showAddSpeakerInput, setShowAddSpeakerInput] = useState(false);
  const [tempCoHost, setTempCoHost] = useState("");
  const [tempSpeaker, setTempSpeaker] = useState("");

  const initialParticipantIds = internalUsers
    .filter((u) => event?.attendees.some((a) => a.email === u.email))
    .map((u) => u.id);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialParticipantIds);

  const currentUser = internalUsers.find((u) => u.id === currentUserId);
  const userName = currentUser?.name || currentUser?.email || "mohit.thakre";

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - 1);
    if (new Date(start) < now) {
      alert("Cannot create an event in the past.");
      e.preventDefault();
      return;
    }

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
      title: title || "Scheduled Event",
      description: meetingType === "online" ? `Online Meeting (${meetingMode.toUpperCase()})` : `Location: ${location}`,
      start: new Date(start),
      end: new Date(end),
      isAllDay: false,
      organizerEmail: currentUser?.email ?? "mohit.thakre@zylker.com",
      attendees: attendeesList,
    };

    if (onEventCreatedLocally) {
      onEventCreatedLocally(newEvt);
    }
  }

  const successMessage = mode === "create" ? "created" : "updated";
  if (state.message === successMessage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs">
        <div className="w-full max-w-xl h-full border-l border-border bg-card p-6 shadow-2xl text-card-foreground flex flex-col justify-center items-center">
          <div className="mb-4 flex flex-col items-center gap-3 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={48} />
            <h3 className="text-xl font-bold text-foreground">
              {mode === "create" ? "Event Scheduled Successfully!" : "Event Updated!"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {title} has been added to your calendar schedule.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              router.refresh();
              onClose();
            }}
            className="mt-4 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Slide-over Drawer Panel */}
      <div className="w-full max-w-xl h-full border-l border-border bg-card text-card-foreground shadow-2xl flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>All Events</span>
            <span>&gt;</span>
            <span className="font-semibold text-foreground">
              {mode === "create" ? "Create Event" : "Edit Event"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Profile Pill */}
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
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
          <input type="hidden" name="meetingType" value={meetingType} />
          <input type="hidden" name="meetingMode" value={meetingMode} />
          <input type="hidden" name="meetingLink" value={meetingLink} />
          <input type="hidden" name="alertType" value={alertType} />
          <input type="hidden" name="isRecording" value={String(isRecording)} />
          <input type="hidden" name="participantEmail" value={participantEmail} />
          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="participantIds" value={id} />
          ))}

          {mode === "edit" && event && (
            <>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="etag" value={event.etag} />
              {initialParticipantIds.map((id) => (
                <input key={id} type="hidden" name="previousParticipantIds" value={id} />
              ))}
            </>
          )}

          {/* Meeting Type Selector (Face to Face vs Online Meeting) */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMeetingType("face-to-face")}
                className={`flex items-center justify-center gap-2.5 rounded-xl border py-3 px-4 text-xs font-semibold transition-all ${
                  meetingType === "face-to-face"
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
                className={`flex items-center justify-center gap-2.5 rounded-xl border py-3 px-4 text-xs font-semibold transition-all ${
                  meetingType === "online"
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
          </div>

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
          <div className="space-y-2">
            <label className="block text-xs font-medium text-foreground">
              Date &amp; Time
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="datetime-local"
                  name="start"
                  min={toDateTimeLocalValue(new Date())}
                  value={toDateTimeLocalValue(start)}
                  onChange={(e) => setStart(new Date(e.target.value))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary transition-all"
                />
              </div>
              <span className="text-xs text-muted-foreground font-medium">to</span>
              <div className="relative flex-1">
                <input
                  type="datetime-local"
                  name="end"
                  min={toDateTimeLocalValue(start)}
                  value={toDateTimeLocalValue(end)}
                  onChange={(e) => setEnd(new Date(e.target.value))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary transition-all"
                />
              </div>
            </div>
            {state.errors?.start && (
              <p className="text-xs text-destructive">{state.errors.start[0]}</p>
            )}
            {state.errors?.end && (
              <p className="text-xs text-destructive">{state.errors.end[0]}</p>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground underline decoration-muted-foreground/40 underline-offset-4">
                ( GMT +05:30 ) India Standard Time(Asia/Kolkata)
              </span>
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="isAllDay"
                  checked={repeatEvent}
                  onChange={(e) => setRepeatEvent(e.target.checked)}
                  className="rounded border-input bg-background text-primary focus:ring-primary"
                />
                Repeat event
              </label>
            </div>
          </div>

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
            <div className="relative">
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
            </div>
          </div>

          {/* Meeting Mode (Audio vs Video + Record option) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-4">
              <label className="text-xs font-medium text-foreground min-w-[90px]">
                Meeting Mode
              </label>
              <div className="flex items-center gap-2">
                <div className="flex rounded-full bg-muted p-0.5 border border-border">
                  <button
                    type="button"
                    onClick={() => setMeetingMode("audio")}
                    className={`flex items-center gap-1.5 rounded-full px-4 py-1 text-xs font-semibold transition-all ${
                      meetingMode === "audio"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Phone size={13} />
                    Audio
                  </button>
                  <button
                    type="button"
                    onClick={() => setMeetingMode("video")}
                    className={`flex items-center gap-1.5 rounded-full px-4 py-1 text-xs font-semibold transition-all ${
                      meetingMode === "video"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Video size={13} />
                    Video
                  </button>
                </div>
                <Info size={14} className="text-muted-foreground cursor-pointer hover:text-foreground" />
              </div>

              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer ml-auto select-none">
                <input
                  type="checkbox"
                  checked={isRecording}
                  onChange={(e) => setIsRecording(e.target.checked)}
                  className="rounded border-input bg-background text-primary focus:ring-primary"
                />
                <span>Record</span>
                <Info size={13} className="text-muted-foreground cursor-pointer" />
              </label>
            </div>

            {/* Quick Links: Co-hosts and Speakers */}
            <div className="flex items-center gap-4 text-xs text-primary pt-1">
              <button
                type="button"
                onClick={() => setShowAddCoHostInput(!showAddCoHostInput)}
                className="hover:underline flex items-center gap-1 font-medium"
              >
                • +Add Co-hosts
              </button>
              <button
                type="button"
                onClick={() => setShowAddSpeakerInput(!showAddSpeakerInput)}
                className="hover:underline flex items-center gap-1 font-medium"
              >
                • +Add Speakers
              </button>
            </div>

            {/* Co-host input row */}
            {showAddCoHostInput && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="email"
                  value={tempCoHost}
                  onChange={(e) => setTempCoHost(e.target.value)}
                  placeholder="co-host@zylker.com"
                  className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1 text-xs text-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (tempCoHost) {
                      setCoHosts([...coHosts, tempCoHost]);
                      setTempCoHost("");
                      setShowAddCoHostInput(false);
                    }
                  }}
                  className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                >
                  Add
                </button>
              </div>
            )}
            {coHosts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {coHosts.map((ch, idx) => (
                  <span key={idx} className="rounded-full bg-muted border border-border px-2.5 py-0.5 text-[11px] text-foreground">
                    Co-host: {ch}
                  </span>
                ))}
              </div>
            )}

            {/* Speaker input row */}
            {showAddSpeakerInput && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="email"
                  value={tempSpeaker}
                  onChange={(e) => setTempSpeaker(e.target.value)}
                  placeholder="speaker@zylker.com"
                  className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1 text-xs text-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (tempSpeaker) {
                      setSpeakers([...speakers, tempSpeaker]);
                      setTempSpeaker("");
                      setShowAddSpeakerInput(false);
                    }
                  }}
                  className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                >
                  Add
                </button>
              </div>
            )}
            {speakers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {speakers.map((sp, idx) => (
                  <span key={idx} className="rounded-full bg-muted border border-border px-2.5 py-0.5 text-[11px] text-foreground">
                    Speaker: {sp}
                  </span>
                ))}
              </div>
            )}
          </div>

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
                      className={`font-semibold transition-colors pb-1 border-b-2 ${
                        assignToTab === "participants"
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Participants
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignToTab("conversation")}
                      className={`font-semibold transition-colors pb-1 border-b-2 ${
                        assignToTab === "conversation"
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Conversation
                    </button>
                  </div>

                  {assignToTab === "participants" ? (
                    <div className="space-y-2 pt-1">
                      <input
                        type="email"
                        value={participantEmail}
                        onChange={(e) => setParticipantEmail(e.target.value)}
                        placeholder="scott.fisher@zylker.com"
                        className="w-full rounded-lg border border-input bg-background px-3.5 py-2 text-xs text-foreground outline-none focus:border-primary"
                      />
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
                <div className="space-y-2">
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
                </div>
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
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>Advanced</span>
              {isAdvancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-border px-5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-primary px-6 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all shadow-xs"
              >
                {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}


