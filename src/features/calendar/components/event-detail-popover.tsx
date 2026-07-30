"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil, Trash2 } from "lucide-react";
import { deleteCalendarEvent, type DeleteEventState } from "../actions/delete-event";
import {
  respondToCalendarInvite,
  type RespondToInviteState,
} from "../actions/respond-to-invite";
import { formatEventTimeRange, formatFullDate } from "../utils";
import type { CalendarEventView } from "../queries";

type Props = {
  event: CalendarEventView;
  currentUserEmail: string;
  onClose: () => void;
  onEdit: () => void;
};

export function EventDetailPopover({ event, currentUserEmail, onClose, onEdit }: Props) {
  const router = useRouter();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-base font-semibold pr-4">{event.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">{formatFullDate(event.start)}</p>
          <p className="text-muted-foreground">
            {formatEventTimeRange(event.start, event.end, event.isAllDay)}
          </p>
          {event.organizerEmail && (
            <p className="text-muted-foreground">Organizer: {event.organizerEmail}</p>
          )}
          {event.description && <p className="mt-2 whitespace-pre-wrap">{event.description}</p>}

          {event.attendees.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Participants</p>
              <ul className="flex flex-col gap-0.5">
                {event.attendees.map((a) => (
                  <li key={a.email} className="text-xs text-muted-foreground">
                    {a.email}
                    {a.status ? ` — ${a.status}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {respondState.message && respondState.message !== "responded" && (
          <p className="mt-3 text-xs text-destructive">
            {respondState.message === "connect_required"
              ? "Connect your own Zoho Calendar to respond to this invite."
              : respondState.message}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {!isOrganizer && (
            <>
              <form action={respondAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="response" value="accept" />
                <button
                  type="submit"
                  disabled={respondPending}
                  className="rounded-lg border py-2 px-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  Accept
                </button>
              </form>
              <form action={respondAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="response" value="decline" />
                <button
                  type="submit"
                  disabled={respondPending}
                  className="rounded-lg border py-2 px-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  Decline
                </button>
              </form>
            </>
          )}

          {isOrganizer && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1.5 rounded-lg border py-2 px-3 text-sm font-medium hover:bg-accent"
              >
                <Pencil size={13} /> Edit
              </button>
              <form action={deleteAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="etag" value={event.etag} />
                <button
                  type="submit"
                  disabled={deletePending}
                  className="flex items-center gap-1.5 rounded-lg border border-destructive/30 py-2 px-3 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 size={13} /> {deletePending ? "Deleting…" : "Delete"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
