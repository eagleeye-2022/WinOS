"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil, Trash2, Clock, Crown, User as UserIcon, Loader2 } from "lucide-react";
import { deleteCalendarEvent, type DeleteEventState } from "../actions/delete-event";
import {
  respondToCalendarInvite,
  type RespondToInviteState,
} from "../actions/respond-to-invite";
import { formatFullDate } from "../utils";
import type { CalendarEventView } from "../queries";

type Props = {
  event: CalendarEventView;
  currentUserEmail: string;
  onClose: () => void;
  onEdit: () => void;
  onRespond?: (status: string) => void;
};

export function EventDetailPopover({ event, currentUserEmail, onClose, onEdit, onRespond }: Props) {
  const router = useRouter();
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  const [deleteState, deleteAction, deletePending] = useActionState<DeleteEventState, FormData>(
    deleteCalendarEvent,
    {},
  );
  const [respondState, respondAction, respondPending] = useActionState<
    RespondToInviteState,
    FormData
  >(respondToCalendarInvite, {});

  const isOrganizer =
    !event.organizerEmail || event.organizerEmail.toLowerCase() === currentUserEmail.toLowerCase();

  if (deleteState.message === "deleted") {
    router.refresh();
    onClose();
    return null;
  }

  // Format Date Badge (e.g. Month: "July", Day: "31")
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(event.start);
  const dayNum = event.start.getDate();

  // Format Time Range (e.g. "Today (04:30 PM to 05:30 PM)")
  const startTimeStr = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).format(event.start);
  const endTimeStr = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).format(event.end);
  const isToday = new Date().toDateString() === event.start.toDateString();
  const datePrefix = isToday ? "Today" : formatFullDate(event.start);

  // Attendees Stats Calculation
  const attendees = event.attendees || [];
  const acceptedCount = attendees.filter((a) => a.status === "ACCEPTED").length;
  const declinedCount = attendees.filter((a) => a.status === "DECLINED").length;
  const tentativeCount = attendees.filter((a) => a.status === "TENTATIVE" || a.status === "MAYBE").length;
  const pendingCount = attendees.filter((a) => !a.status || a.status === "NEEDS_ACTION" || a.status === "PENDING").length;

  const currentUserAttendee = event.attendees?.find((a) => {
    if (!a) return false;
    if (currentUserEmail && a.email && a.email.toLowerCase() === currentUserEmail.toLowerCase()) {
      return true;
    }
    return false;
  });

  const rawStatus = (localStatus || currentUserAttendee?.status)?.toUpperCase() || "NEEDS_ACTION";
  const currentUserStatus =
    rawStatus === "ACCEPT" ? "ACCEPTED" : rawStatus === "DECLINE" ? "DECLINED" : rawStatus;

  const hasResponded =
    currentUserStatus === "ACCEPTED" ||
    currentUserStatus === "DECLINED" ||
    currentUserStatus === "TENTATIVE" ||
    currentUserStatus === "MAYBE";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-overlay backdrop-blur-xs animate-in fade-in duration-200">
      {/* Slide-over Event Details Drawer Panel styled with WinOS Theme Tokens */}
      <div className="w-full max-w-xl h-full border-l border-border bg-card text-card-foreground shadow-2xl flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-background">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>All Events</span>
            <span>&gt;</span>
            <span className="font-semibold text-foreground">Event Details</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          
          {/* Main Event Card Box */}
          <div className="rounded-xl border border-border bg-background/50 p-5 shadow-xs space-y-4">
            
            {/* Top row: Date Badge + Title + Profile Badge */}
            <div className="flex items-start gap-4">
              
              {/* Date Box with Accent Bar */}
              <div className="relative flex flex-col items-center justify-center rounded-lg bg-card border border-border px-4 py-2.5 min-w-[64px] overflow-hidden shadow-2xs">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500" />
                <span className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
                  {monthName}
                </span>
                <span className="text-xl font-bold text-foreground leading-tight">
                  {dayNum}
                </span>
              </div>

              {/* Title & Host Profile Badge */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <h3 className="text-lg font-bold text-foreground truncate leading-snug">
                  {event.title}
                </h3>

                {/* Organizer Profile Pill */}
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs text-foreground">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <span className="font-medium truncate max-w-[150px]">
                    {event.organizerEmail ? event.organizerEmail.split("@")[0] : currentUserEmail.split("@")[0]}
                  </span>
                </div>
              </div>
            </div>

            {/* Event Time & Timezone */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <Clock size={15} className="text-muted-foreground shrink-0" />
              <span>
                {datePrefix} ({startTimeStr} to {endTimeStr})
              </span>
              <span className="text-muted-foreground font-semibold">Asia/Calcutta</span>
            </div>

            {/* Host Indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Crown size={15} className="text-amber-500 shrink-0" />
              <span>{isOrganizer ? "You" : (event.organizerEmail || "Organizer")}</span>
            </div>

            {/* Dotted Divider */}
            <div className="border-b border-dashed border-border my-3" />

            {/* Host Status Subtext */}
            <div className="text-xs text-foreground font-medium">
              {isOrganizer ? (
                <span>You&apos;re the host of this meeting. Get started!</span>
              ) : currentUserStatus === "ACCEPTED" ? (
                <span className="text-success font-semibold">✓ You have accepted this invitation.</span>
              ) : currentUserStatus === "DECLINED" ? (
                <span className="text-destructive font-semibold">✕ You declined this invitation.</span>
              ) : (
                <span>You are invited to participate in this event.</span>
              )}
            </div>
          </div>

          {/* Attendees Summary Section */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-foreground font-bold">Attendees -</span>
                <span className="text-success font-semibold">{acceptedCount} Accepted</span>
                <span className="text-muted-foreground">|</span>
                <span className="text-destructive font-semibold">{declinedCount} Declined</span>
                <span className="text-muted-foreground">|</span>
                <span className="text-warning font-semibold">{tentativeCount} May attend</span>
                <span className="text-muted-foreground">|</span>
                <span className="text-muted-foreground">{pendingCount} Yet to decide</span>
              </div>
            </div>

            {/* Attendee List */}
            <div className="space-y-2.5">
              {attendees.length > 0 ? (
                attendees.map((a, idx) => {
                  const nameStr = a.email.split("@")[0].replace(".", " ");
                  const initials = nameStr
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-border bg-background/50 p-3 hover:bg-accent/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground border border-border">
                          {initials || <UserIcon size={16} />}
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground capitalize truncate">
                            {nameStr}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {a.email}
                          </p>
                        </div>
                      </div>

                      {/* Status pill */}
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground capitalize">
                        {a.status || "Yet to decide"}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground italic">No attendees added yet.</p>
              )}
            </div>
          </div>

          {respondState.message && respondState.message !== "responded" && (
            <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded border border-destructive/20">
              {respondState.message}
            </p>
          )}
        </div>

        {/* Action Footer */}
        <div className="bg-background border-t border-border px-6 py-4 flex items-center justify-end gap-3">
          {!isOrganizer && (
            <>
              {hasResponded ? (
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold border ${
                      currentUserStatus === "ACCEPTED"
                        ? "bg-success/10 border-success/30 text-success"
                        : "bg-danger/10 border-danger/30 text-danger"
                    }`}
                  >
                    {currentUserStatus === "ACCEPTED" ? "✓ Accepted" : "✕ Declined"}
                  </span>
                </div>
              ) : (
                <>
                  <form
                    action={async (formData) => {
                      setLocalStatus("ACCEPTED");
                      onRespond?.("ACCEPTED");
                      await respondAction(formData);
                      router.refresh();
                    }}
                  >
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="response" value="accept" />
                    <button
                      type="submit"
                      disabled={respondPending}
                      className="flex items-center gap-1.5 rounded-full bg-success px-5 py-2 text-xs font-semibold text-success-foreground hover:opacity-90 disabled:opacity-50 transition-all shadow-2xs"
                    >
                      {respondPending && <Loader2 size={13} className="animate-spin" />}
                      Accept
                    </button>
                  </form>
                  <form
                    action={async (formData) => {
                      setLocalStatus("DECLINED");
                      onRespond?.("DECLINED");
                      await respondAction(formData);
                      router.refresh();
                    }}
                  >
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="response" value="decline" />
                    <button
                      type="submit"
                      disabled={respondPending}
                      className="flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      {respondPending && <Loader2 size={13} className="animate-spin" />}
                      Decline
                    </button>
                  </form>
                </>
              )}
            </>
          )}

          {isOrganizer && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
              >
                <Pencil size={13} /> Edit
              </button>
              <form
                action={async (formData) => {
                  if (confirm("Are you sure you want to delete this event?")) {
                    await deleteAction(formData);
                    router.refresh();
                    onClose();
                  }
                }}
              >
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="etag" value={event.etag} />
                <button
                  type="submit"
                  disabled={deletePending}
                  className="flex items-center gap-1.5 rounded-full bg-destructive/10 border border-destructive/30 px-5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {deletePending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} {deletePending ? "Deleting…" : "Delete"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


