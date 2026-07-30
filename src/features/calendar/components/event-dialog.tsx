"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { X, CheckCircle2 } from "lucide-react";
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
};

export function EventDialog({ mode, event, defaultStart, internalUsers, currentUserId, onClose }: Props) {
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

  const initialParticipantIds = internalUsers
    .filter((u) => event?.attendees.some((a) => a.email === u.email))
    .map((u) => u.id);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialParticipantIds);
  const [isAllDay, setIsAllDay] = useState(event?.isAllDay ?? false);

  const start = event?.start ?? defaultStart ?? new Date();
  const end = event?.end ?? new Date(start.getTime() + 60 * 60 * 1000);

  const successMessage = mode === "create" ? "created" : "updated";
  if (state.message === successMessage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
          <div className="mb-4 flex items-center gap-2 text-emerald-700">
            <CheckCircle2 size={18} />
            <span className="font-semibold">
              {mode === "create" ? "Event created." : "Event updated."}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              router.refresh();
              onClose();
            }}
            className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {mode === "create" ? "Create Event" : "Edit Event"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent"
          >
            <X size={15} />
          </button>
        </div>

        <form action={action} className="flex flex-col gap-4">
          {mode === "edit" && event && (
            <>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="etag" value={event.etag} />
              {initialParticipantIds.map((id) => (
                <input key={id} type="hidden" name="previousParticipantIds" value={id} />
              ))}
            </>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              name="title"
              defaultValue={event?.title}
              placeholder="Event title"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {state.errors?.title && (
              <p className="mt-1 text-xs text-destructive">{state.errors.title[0]}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <input
                type="checkbox"
                name="isAllDay"
                checked={isAllDay}
                onChange={(e) => setIsAllDay(e.target.checked)}
                className="accent-primary"
              />
              All day
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Start <span className="text-destructive">*</span>
              </label>
              <input
                type="datetime-local"
                name="start"
                defaultValue={toDateTimeLocalValue(start)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              {state.errors?.start && (
                <p className="mt-1 text-xs text-destructive">{state.errors.start[0]}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                End <span className="text-destructive">*</span>
              </label>
              <input
                type="datetime-local"
                name="end"
                defaultValue={toDateTimeLocalValue(end)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              {state.errors?.end && (
                <p className="mt-1 text-xs text-destructive">{state.errors.end[0]}</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              defaultValue={event?.description}
              placeholder="Add a description..."
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Invite teammates
            </label>
            <ParticipantPicker
              users={internalUsers}
              currentUserId={currentUserId}
              selectedIds={selectedIds}
              onChange={setSelectedIds}
            />
          </div>

          {state.message && state.message !== successMessage && (
            <p className="text-xs text-destructive">{state.message}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border py-2 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving…" : mode === "create" ? "Create Event" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
