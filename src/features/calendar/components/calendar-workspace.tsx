"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from "lucide-react";
import { ConnectZohoBanner } from "./connect-zoho-banner";
import { CalendarWeekView } from "./calendar-week-view";
import { CalendarMonthView } from "./calendar-month-view";
import { EventDialog } from "./event-dialog";
import { EventDetailPopover } from "./event-detail-popover";
import { getWeekDays } from "../utils";
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
  connectedBanner?: boolean;
  errorBanner?: string;
  focusEventId?: string;
};

export function CalendarWorkspace({
  events: initialEvents,
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
  const pathname = usePathname();
  const anchorDate = useMemo(() => new Date(anchorDateIso), [anchorDateIso]);

  // Local state for client-side events
  const [localEvents, setLocalEvents] = useState<CalendarEventView[]>(initialEvents);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventView | null>(null);
  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; defaultStart?: Date; event?: CalendarEventView } | null>(
    null,
  );

  // Keep localEvents in sync with server revalidation
  useEffect(() => {
    setLocalEvents(initialEvents);
  }, [initialEvents]);

  function handleEventResponded(eventId: string, newStatus: string) {
    setLocalEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        const attendees = (ev.attendees || []).map((a) =>
          a.email.toLowerCase() === currentUserEmail.toLowerCase()
            ? { ...a, status: newStatus }
            : a,
        );
        const hasUser = attendees.some((a) => a.email.toLowerCase() === currentUserEmail.toLowerCase());
        const finalAttendees = hasUser
          ? attendees
          : [...attendees, { email: currentUserEmail, status: newStatus }];

        const updated = { ...ev, attendees: finalAttendees };
        if (selectedEvent?.id === eventId) {
          setSelectedEvent(updated);
        }
        return updated;
      }),
    );
  }

  // Computed Date Range Text (e.g. "26 Jul - 01 Aug 2026")
  const weekDays = useMemo(() => getWeekDays(anchorDate), [anchorDate]);
  const dateRangeLabel = useMemo(() => {
    if (view === "month") {
      return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(anchorDate);
    }
    const startStr = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short" }).format(weekDays[0]);
    const endStr = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" }).format(
      weekDays[6],
    );
    return `${startStr} - ${endStr}`;
  }, [view, anchorDate, weekDays]);

  function navigateTo(targetView: "week" | "month", date: Date) {
    const params = new URLSearchParams({ view: targetView, date: date.toISOString() });
    router.push(`${pathname}?${params.toString()}`);
  }

  function step(direction: -1 | 1) {
    const next = new Date(anchorDate);
    if (view === "week") next.setDate(next.getDate() + direction * 7);
    else next.setMonth(next.getMonth() + direction);
    navigateTo(view, next);
  }

  function handleEventCreatedLocally(newEvent: CalendarEventView) {
    setLocalEvents((prev) => [newEvent, ...prev]);
    setDialog(null);
    setSelectedEvent(newEvent);
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground overflow-hidden font-sans">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-3.5 shadow-2xs">
        <div className="flex items-center gap-4">
          {/* <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <CalendarIcon size={18} />
            </div>
            <h1 className="text-base font-bold text-foreground tracking-tight">Calendar</h1>
          </div> */}

          {/* <div className="h-5 w-[1px] bg-border" /> */}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateTo(view, new Date())}
              className="rounded-lg border border-border bg-secondary px-3 py-1 text-xs font-semibold text-primary hover:bg-accent transition-all"
            >
              Today
            </button>

            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5">
              <button
                type="button"
                onClick={() => step(-1)}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Previous"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Next"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <span className="text-sm font-semibold text-foreground pl-1">{dateRangeLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Zoho Connection Status Badge or Connect Button commented out */}
          {/* {connectionStatus.connected ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="truncate max-w-[180px]">
                Zoho: {connectionStatus.zohoEmail ?? "Connected"}
              </span>
            </div>
          ) : (
            <a
              href="/api/auth/zoho/login"
              className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-all"
            >
              <CalendarIcon size={14} /> Connect Zoho Calendar
            </a>
          )} */}

          {/* View Toggle */}
          <div className="flex rounded-xl border border-border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => navigateTo("week", anchorDate)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${view === "week"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => navigateTo("month", anchorDate)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${view === "month"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Month
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDialog({ mode: "create", defaultStart: new Date() })}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-90 active:scale-95 transition-all"
          >
            <Plus size={15} /> Create Event
          </button>
        </div>
      </div>

      {connectedBanner && (
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-6 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Zoho Calendar connected{connectionStatus.zohoEmail ? ` as ${connectionStatus.zohoEmail}` : ""}.
        </div>
      )}
      {errorBanner && (
        <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-2 text-xs font-medium text-destructive flex items-center justify-between">
          <span>Failed to connect Zoho Calendar: {errorBanner}</span>
          <a href="/api/auth/zoho/login" className="underline font-semibold hover:opacity-80">
            Try again
          </a>
        </div>
      )}

      {/* Main View Grid */}
      <div className="flex-1 overflow-hidden relative">
        {view === "week" ? (
          <CalendarWeekView
            anchorDate={anchorDate}
            events={localEvents}
            onSelectEvent={setSelectedEvent}
            onSelectSlot={(start) => setDialog({ mode: "create", defaultStart: start })}
          />
        ) : (
          <CalendarMonthView
            anchorDate={anchorDate}
            events={localEvents}
            onSelectEvent={setSelectedEvent}
            onSelectSlot={(start) => setDialog({ mode: "create", defaultStart: start })}
          />
        )}
      </div>

      {selectedEvent && !dialog && (
        <EventDetailPopover
          event={selectedEvent}
          currentUserEmail={currentUserEmail}
          onClose={() => setSelectedEvent(null)}
          onEdit={() => {
            setDialog({ mode: "edit", event: selectedEvent });
          }}
          onRespond={(status) => handleEventResponded(selectedEvent.id, status)}
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
          onEventCreatedLocally={handleEventCreatedLocally}
        />
      )}
    </div>
  );
}


