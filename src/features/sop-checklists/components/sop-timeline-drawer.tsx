"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, History, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { projectTaskHref } from "@/lib/project-task-href";
import { getSopTimelineAction, type SopTimelineQuery } from "../actions/timeline-actions";
import { describeSopEvent, SOP_EVENT_GROUPS, type SopEventGroup, type SopEventView } from "../event-types";

const GROUP_STYLES: Record<SopEventGroup, string> = {
  SOP: "bg-primary",
  PICKED: "bg-info",
  TICKS: "bg-success",
  ITEMS: "bg-warning",
  CLOSING: "bg-destructive",
};

function groupOf(type: SopEventView["type"]): SopEventGroup {
  for (const [g, def] of Object.entries(SOP_EVENT_GROUPS)) {
    if ((def.types as string[]).includes(type)) return g as SopEventGroup;
  }
  return "SOP";
}

function dayLabel(iso: string): string {
  const day = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return "Today";
  if (day.toDateString() === yesterday.toDateString()) return "Yesterday";
  return day.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

interface SopTimelineDrawerProps {
  open: boolean;
  onClose: () => void;
  /** e.g. "Website Development SOP" or "WI1-T11 · SOP checklist". */
  title: string;
  query: Omit<SopTimelineQuery, "before">;
  /** In one SOP's timeline, SOP events read "this SOP" and the task filter is offered. */
  sopScope?: boolean;
}

/** Timeline of an SOP (or of one task's checklists), in a drawer from the right. */
export function SopTimelineDrawer({ open, onClose, title, query, sopScope = false }: SopTimelineDrawerProps) {
  const [events, setEvents] = useState<SopEventView[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Always "ALL" while the filter chips are commented out (restore `setGroup` with them).
  const [group] = useState<SopEventGroup | "ALL">("ALL");
  const [taskFilter, setTaskFilter] = useState("");
  const [search, setSearch] = useState("");
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getSopTimelineAction(JSON.parse(queryKey))
      .then((res) => {
        if (cancelled) return;
        setEvents(res.events);
        setHasMore(res.hasMore);
        setError(res.error ?? null);
      })
      .catch((err) => {
        console.error("Failed to load the SOP timeline:", err);
        if (!cancelled) setError("Couldn't load the timeline");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, queryKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const loadMore = async () => {
    const last = events[events.length - 1];
    if (!last) return;
    setIsLoading(true);
    try {
      const res = await getSopTimelineAction({ ...JSON.parse(queryKey), before: last.createdAt });
      setEvents((prev) => [...prev, ...res.events]);
      setHasMore(res.hasMore);
    } finally {
      setIsLoading(false);
    }
  };

  const taskOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of events) if (e.taskId && !seen.has(e.taskId)) seen.set(e.taskId, `${e.taskCode ?? ""} · ${e.taskTitle ?? ""}`);
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [events]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (group !== "ALL" && groupOf(e.type) !== group) return false;
      if (taskFilter && e.taskId !== taskFilter) return false;
      if (!q) return true;
      return [e.actorName, e.taskCode, e.taskTitle, e.itemText, e.templateName, describeSopEvent(e, sopScope)]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [events, group, taskFilter, search, sopScope]);

  const byDay = useMemo(() => {
    const out: { day: string; events: SopEventView[] }[] = [];
    for (const e of shown) {
      const day = dayLabel(e.createdAt);
      if (out[out.length - 1]?.day !== day) out.push({ day, events: [] });
      out[out.length - 1].events.push(e);
    }
    return out;
  }, [shown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-overlay backdrop-blur-xs" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-xl flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Timeline: ${title}`}
      >
        <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <History size={16} className="text-primary" /> Timeline
            </h2>
            <p className="truncate text-xs text-muted-foreground" title={title}>
              {title}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent" title="Close">
            <X size={16} />
          </button>
        </header>

        <div className="space-y-2 border-b px-5 py-3 text-xs">
          {/* Event-type filter chips, hidden by request:
          <div className="flex flex-wrap gap-1.5">
            {(["ALL", ...Object.keys(SOP_EVENT_GROUPS)] as (SopEventGroup | "ALL")[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                className={cn(
                  "rounded-full border px-2.5 py-1 font-semibold transition-colors",
                  group === g ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
                )}
              >
                {g === "ALL" ? "All" : SOP_EVENT_GROUPS[g].label}
              </button>
            ))}
          </div> */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-40 flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search people, tasks, items"
                className="w-full rounded-md border bg-background py-1.5 pl-8 pr-2 outline-none focus:border-primary"
              />
            </div>
            {sopScope && taskOptions.length > 0 && (
              <SearchableSelect
                value={taskFilter}
                onChange={setTaskFilter}
                options={taskOptions}
                placeholder="All tasks"
                searchPlaceholder="Search tasks..."
                className="flex max-w-[200px] items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 font-medium"
                contentClassName="w-80"
              />
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-xs">
          {isLoading && events.length === 0 ? (
            <div className="flex justify-center p-10">
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          ) : error ? (
            <p className="p-8 text-center text-muted-foreground">{error}</p>
          ) : byDay.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">
              {events.length === 0 ? "Nothing has happened here yet." : "No events match these filters."}
            </p>
          ) : (
            <div className="space-y-5">
              {byDay.map(({ day, events: dayEvents }) => (
                <section key={day}>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{day}</h3>
                  <ol className="relative space-y-3 border-l pl-5 dark:border-zinc-800">
                    {dayEvents.map((e) => (
                      <TimelineRow key={e.id} event={e} sopScope={sopScope} />
                    ))}
                  </ol>
                </section>
              ))}
              {hasMore && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={loadMore}
                  className="mx-auto flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-semibold hover:bg-accent disabled:opacity-60"
                >
                  {isLoading && <Loader2 size={12} className="animate-spin" />}
                  Load older events
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function initialsOf(name: string | null): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function TimelineRow({ event: e, sopScope }: { event: SopEventView; sopScope: boolean }) {
  const href = e.taskCode ? projectTaskHref(e.projectCode, e.taskCode) : null;
  const time = new Date(e.createdAt);
  const d = e.details || {};
  const note = typeof d.note === "string" && d.note ? d.note : null;
  const proof = typeof d.evidenceUrl === "string" && d.evidenceUrl ? d.evidenceUrl : null;

  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -left-[25px] top-2 h-2.5 w-2.5 rounded-full ring-2 ring-background",
          GROUP_STYLES[groupOf(e.type)]
        )}
      />
      <div className="flex items-start gap-2.5">
        {/* Profile photo when the user has one, else their initials. */}
        <UserAvatar
          userId={e.actorId}
          name={e.actorName}
          className="h-8 w-8 bg-primary/15 text-[11px] font-bold text-primary"
          title={e.actorName ?? ""}
        >
          {initialsOf(e.actorName)}
        </UserAvatar>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[13px] font-semibold text-foreground">{e.actorName ?? "Someone"}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground" title={time.toLocaleString()}>
              {time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
          <p className="leading-snug text-foreground">{capitalize(describeSopEvent(e, sopScope))}</p>
          {href && (
            <Link href={`${href}?tab=checklist`} className="inline-flex max-w-full items-center gap-1 text-primary hover:underline">
              <span className="font-mono text-[11px]">{e.taskCode}</span>
              <span className="truncate">{e.taskTitle}</span>
              <ExternalLink size={10} className="shrink-0" />
            </Link>
          )}
          {!sopScope && e.templateName && e.type.startsWith("ITEM") && (
            <p className="text-[11px] text-muted-foreground">in {e.templateName}</p>
          )}
          {(note || proof) && (
            <p className="text-[11px] text-muted-foreground">
              {note && <span className="italic">“{note}”</span>}
              {proof && (
                <a href={proof} target="_blank" rel="noreferrer" className="ml-1 text-primary hover:underline">
                  proof link
                </a>
              )}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground" title={time.toLocaleString()}>
            {time.toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
            {d.backfilled === true && " · from earlier records"}
          </p>
        </div>
      </div>
    </li>
  );
}
