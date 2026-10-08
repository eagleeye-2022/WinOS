"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNoteTimeline, type NoteTimelineResult } from "../actions/get-note-timeline";

const DOT_COLOR: Record<string, string> = {
  CREATED: "bg-emerald-500",
  UPDATED: "bg-blue-500",
  CHECKLIST_CHECKED: "bg-violet-500",
  CHECKLIST_UNCHECKED: "bg-violet-400",
  MOVED: "bg-amber-500",
  SHARED_TO_PROJECT: "bg-teal-500",
  REMOVED_FROM_PROJECT: "bg-rose-500",
};

const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

/**
 * Right-side drawer with a card's timeline: who created, updated, ticked, moved or shared the
 * card, newest first. Mount it only while open — it loads fresh data every time it opens.
 */
export function NoteTimelineDrawer({
  noteId,
  cardTitle,
  onClose,
}: {
  noteId: string;
  cardTitle?: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<NoteTimelineResult | null>(null);
  const [loading, setLoading] = useState(true);
  // Slide in on mount, slide out before unmounting (CSS transition on translate-x).
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const close = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getNoteTimeline(noteId));
    } catch {
      setData({ success: false, error: "Couldn't load the timeline. Please try again." });
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    let cancelled = false;
    getNoteTimeline(noteId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData({ success: false, error: "Couldn't load the timeline. Please try again." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  // Esc closes the drawer only (not the card dialog underneath).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Card timeline">
      <div
        className={cn(
          "absolute inset-0 bg-black/30 transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={close}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "relative flex h-full w-full max-w-sm flex-col border-l bg-card shadow-2xl transition-transform duration-200 ease-out",
          visible ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <History size={16} className="text-primary" />
              <h3 className="text-sm font-bold text-foreground">Card Timeline</h3>
            </div>
            {cardTitle && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{cardTitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              title="Refresh"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw size={14} className={cn(loading && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={close}
              title="Close"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!data ? (
            <div className="flex justify-center py-6">
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
            </div>
          ) : !data.success ? (
            <p className="py-2 text-xs italic text-muted-foreground">{data.error}</p>
          ) : data.events.length === 0 ? (
            <p className="py-2 text-xs italic text-muted-foreground">No activity yet.</p>
          ) : (
            <ol className="relative ml-1.5 border-l border-border">
              {data.events.map((e) => (
                <li key={e.id} className="relative pb-4 pl-4 last:pb-0">
                  <span
                    className={cn(
                      "absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-card",
                      DOT_COLOR[e.action] || "bg-muted-foreground"
                    )}
                  />
                  <p className="text-xs leading-snug text-foreground">
                    <span className="font-semibold">{e.userName}</span>
                    {e.role && (
                      <span
                        className={cn(
                          "ml-1 rounded px-1 py-px text-[10px] font-semibold",
                          e.role === "Manager" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {e.role}
                      </span>
                    )}{" "}
                    {e.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{formatWhen(e.createdAt)}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}
