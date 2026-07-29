"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { ConnectZohoBanner } from "./connect-zoho-banner";
import { CalendarWeekView } from "./calendar-week-view";
import { CalendarMonthView } from "./calendar-month-view";
import { EventDialog } from "./event-dialog";
import { EventDetailPopover } from "./event-detail-popover";
import { formatFullDate } from "../utils";
import type { CalendarEventView, ZohoConnectionStatus } from "../queries";

type InternalUser = { id: string; name: string | null; email: string };

type Props = {
  events: CalendarEventView[];
  connectionStatus: ZohoConnectionStatus;
  internalUsers: InternalUser[];
  view: "week" | "month";
  anchorDateIso: string;
  currentUserId: string;
  currentUserEmail: string;
  connectedBanner: boolean;
  errorBanner?: string;
  focusEventId?: string;
};

export function CalendarWorkspace({
  events,
  connectionStatus,
  internalUsers,
  view,
  anchorDateIso,
  currentUserId,
  currentUserEmail,
  connectedBanner,
  errorBanner,
}: Props) {
  const router = useRouter();
  const anchorDate = useMemo(() => new Date(anchorDateIso), [anchorDateIso]);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEventView | null>(null);
  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; defaultStart?: Date; event?: CalendarEventView } | null>(
    null,
  );

  function navigateTo(view: "week" | "month", date: Date) {
    const params = new URLSearchParams({ view, date: date.toISOString() });
    router.push(`/calendar?${params.toString()}`);
  }

  function step(direction: -1 | 1) {
    const next = new Date(anchorDate);
    if (view === "week") next.setDate(next.getDate() + direction * 7);
    else next.setMonth(next.getMonth() + direction);
    navigateTo(view, next);
  }

  if (!connectionStatus.connected) {
    return (
      <div className="flex h-full flex-col">
        <ConnectZohoBanner />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Calendar</h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => step(-1)}
              className="rounded-md p-1.5 hover:bg-accent"
              aria-label="Previous"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => navigateTo(view, new Date())}
              className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              className="rounded-md p-1.5 hover:bg-accent"
              aria-label="Next"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <span className="text-sm text-muted-foreground">{formatFullDate(anchorDate)}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            <button
              type="button"
              onClick={() => navigateTo("week", anchorDate)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                view === "week" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => navigateTo("month", anchorDate)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                view === "month" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              Month
            </button>
          </div>
          <button
            type="button"
            onClick={() => setDialog({ mode: "create", defaultStart: new Date() })}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus size={14} /> Create Event
          </button>
        </div>
      </div>

      {connectedBanner && (
        <div className="border-b bg-emerald-50 px-6 py-2 text-sm text-emerald-800">
          Zoho Calendar connected{connectionStatus.zohoEmail ? ` as ${connectionStatus.zohoEmail}` : ""}.
        </div>
      )}
      {errorBanner && (
        <div className="border-b bg-destructive/10 px-6 py-2 text-sm text-destructive">
          Failed to connect Zoho Calendar. Please try again.
        </div>
      )}

      {view === "week" ? (
        <CalendarWeekView
          anchorDate={anchorDate}
          events={events}
          onSelectEvent={setSelectedEvent}
          onSelectSlot={(start) => setDialog({ mode: "create", defaultStart: start })}
        />
      ) : (
        <CalendarMonthView
          anchorDate={anchorDate}
          events={events}
          onSelectEvent={setSelectedEvent}
          onSelectSlot={(start) => setDialog({ mode: "create", defaultStart: start })}
        />
      )}

      {selectedEvent && !dialog && (
        <EventDetailPopover
          event={selectedEvent}
          currentUserEmail={currentUserEmail}
          onClose={() => setSelectedEvent(null)}
          onEdit={() => {
            setDialog({ mode: "edit", event: selectedEvent });
          }}
        />
      )}

      {dialog && (
        <EventDialog
          mode={dialog.mode}
          event={dialog.event}
          defaultStart={dialog.defaultStart}
          internalUsers={internalUsers}
          currentUserId={currentUserId}
          onClose={() => {
            setDialog(null);
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}
