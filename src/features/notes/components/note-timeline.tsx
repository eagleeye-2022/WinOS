"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, History, Loader2, RefreshCw, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getNoteTimeline,
  getNoteVersion,
  type NoteTimelineResult,
  type NoteVersionResult,
} from "../actions/get-note-timeline";
import { updateBoardNote } from "../actions/update-board-note";
import { diffNoteSnapshots, noteHtmlToLines, type DiffLine } from "../note-versions";

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
 * card, newest first. Create / edit events are versions (v1, v2…): "View" shows the card as it
 * was then and what changed from the version before, and people who can edit the card can
 * restore it. Mount it only while open — it loads fresh data every time it opens.
 */
export function NoteTimelineDrawer({
  noteId,
  cardTitle,
  onClose,
  canRestore = false,
  onRestored,
}: {
  noteId: string;
  cardTitle?: string | null;
  onClose: () => void;
  /** People who can edit the card may put an older version back. */
  canRestore?: boolean;
  onRestored?: () => void | Promise<void>;
}) {
  const [data, setData] = useState<NoteTimelineResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [openVersion, setOpenVersion] = useState<number | null>(null);
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
          "relative flex h-full w-full max-w-md flex-col border-l bg-card shadow-2xl transition-transform duration-200 ease-out",
          visible ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <History size={16} className="text-primary" />
              <h3 className="text-sm font-bold text-foreground">Card Timeline</h3>
            </div>
            {cardTitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{cardTitle}</p>}
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
          {openVersion !== null ? (
            <NoteVersionView
              key={openVersion}
              noteId={noteId}
              version={openVersion}
              canRestore={canRestore}
              onBack={() => setOpenVersion(null)}
              onRestored={async () => {
                close();
                await onRestored?.();
              }}
            />
          ) : !data ? (
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
                    {e.version !== undefined && (
                      <span className="mr-1 rounded bg-blue-500/10 px-1 py-px font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                        v{e.version}
                      </span>
                    )}
                    <span className="font-semibold">{e.userName}</span>
                    {e.role && (
                      <span
                        className={cn(
                          "ml-1 rounded px-1 py-px text-xs font-semibold",
                          e.role === "Manager" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {e.role}
                      </span>
                    )}{" "}
                    {e.label}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">{formatWhen(e.createdAt)}</p>
                    {e.version !== undefined && (
                      <button
                        type="button"
                        onClick={() => setOpenVersion(e.version as number)}
                        className="rounded border px-1.5 py-px text-[11px] font-semibold text-primary hover:bg-primary/10"
                        title="See the card as it was in this version and what changed"
                      >
                        View
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}

const DIFF_CLS: Record<DiffLine["kind"], string> = {
  added: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  removed: "bg-rose-500/10 text-rose-700 line-through dark:text-rose-400",
  same: "text-muted-foreground",
};
const DIFF_MARK: Record<DiffLine["kind"], string> = { added: "+", removed: "−", same: " " };

function DiffBlock({ label, lines }: { label: string; lines: DiffLine[] }) {
  if (!lines.some((l) => l.kind !== "same")) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="overflow-hidden rounded-md border text-xs">
        {lines.map((l, i) => (
          <div key={i} className={cn("flex gap-2 px-2 py-0.5 whitespace-pre-wrap break-words", DIFF_CLS[l.kind])}>
            <span className="w-3 shrink-0 select-none font-mono">{DIFF_MARK[l.kind]}</span>
            <span>{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** One version of the card: what changed from the version before, the full card, and Restore. */
function NoteVersionView({
  noteId,
  version,
  canRestore,
  onBack,
  onRestored,
}: {
  noteId: string;
  version: number;
  canRestore: boolean;
  onBack: () => void;
  onRestored: () => void | Promise<void>;
}) {
  const [res, setRes] = useState<NoteVersionResult | null>(null);
  const [tab, setTab] = useState<"CHANGES" | "FULL">("CHANGES");
  const [confirming, setConfirming] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getNoteVersion(noteId, version)
      .then((r) => {
        if (!cancelled) setRes(r);
      })
      .catch(() => {
        if (!cancelled) setRes({ success: false, error: "Couldn't load that version. Please try again." });
      });
    return () => {
      cancelled = true;
    };
  }, [noteId, version]);

  const restore = async () => {
    if (!res?.success) return;
    const s = res.snapshot;
    // Saved through the normal edit action, so its permission checks apply and the restore
    // itself becomes the newest version on the timeline.
    const fd = new FormData();
    fd.append("id", noteId);
    fd.append("title", s.title || "");
    fd.append("content", s.content || "");
    fd.append("color", s.color || "#ffffff");
    if (s.deadline) fd.append("deadline", s.deadline);
    s.checklist.forEach((item) => {
      fd.append("item", item.text);
      fd.append("itemChecked", item.checked ? "true" : "false");
    });
    setRestoring(true);
    try {
      const out = await updateBoardNote({}, fd);
      if (out.message === "updated") await onRestored();
      else alert(out.message || "Couldn't restore this version.");
    } catch {
      alert("Couldn't restore this version.");
    } finally {
      setRestoring(false);
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ArrowLeft size={13} /> Back to timeline
      </button>

      {!res ? (
        <div className="flex justify-center py-6">
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        </div>
      ) : !res.success ? (
        <p className="py-2 text-xs italic text-muted-foreground">{res.error}</p>
      ) : (
        (() => {
          const diff = diffNoteSnapshots(res.previous, res.snapshot);
          const nothing =
            !diff.title.some((l) => l.kind !== "same") &&
            !diff.content.some((l) => l.kind !== "same") &&
            !diff.checklist.some((l) => l.kind !== "same") &&
            !diff.deadlineChanged &&
            !diff.colorChanged;
          const isLatest = res.version === res.latestVersion;
          return (
            <>
              <div>
                <p className="text-sm font-bold text-foreground">
                  Version {res.version}
                  {isLatest && (
                    <span className="ml-1.5 rounded bg-emerald-500/10 px-1.5 py-px text-[11px] font-semibold text-emerald-600">
                      Current
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {res.userName} · {formatWhen(res.createdAt)}
                </p>
              </div>

              <div className="flex gap-1 border-b pb-2 text-xs font-semibold">
                {(
                  [
                    ["CHANGES", res.previous ? `What changed (v${res.version - 1} → v${res.version})` : "First version"],
                    ["FULL", "Full card"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={cn(
                      "rounded-md px-2.5 py-1",
                      tab === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "CHANGES" ? (
                <div className="space-y-3">
                  {nothing ? (
                    <p className="text-xs italic text-muted-foreground">No content changes in this version.</p>
                  ) : (
                    <>
                      <DiffBlock label="Title" lines={diff.title} />
                      <DiffBlock label="Content" lines={diff.content} />
                      <DiffBlock label="Checklist" lines={diff.checklist} />
                      {diff.deadlineChanged && (
                        <p className="text-xs text-muted-foreground">
                          <b className="text-foreground">Deadline:</b>{" "}
                          {res.previous?.deadline ? formatWhen(res.previous.deadline) : "none"} →{" "}
                          {res.snapshot.deadline ? formatWhen(res.snapshot.deadline) : "none"}
                        </p>
                      )}
                      {diff.colorChanged && (
                        <p className="text-xs text-muted-foreground">
                          <b className="text-foreground">Colour</b> changed
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3 rounded-md border p-3 text-xs">
                  {res.snapshot.title && <p className="text-sm font-bold text-foreground">{res.snapshot.title}</p>}
                  <div className="space-y-1 text-foreground">
                    {noteHtmlToLines(res.snapshot.content).map((line, i) => (
                      <p key={i} className="whitespace-pre-wrap break-words">
                        {line}
                      </p>
                    ))}
                  </div>
                  {res.snapshot.checklist.length > 0 && (
                    <ul className="space-y-0.5 border-t pt-2">
                      {res.snapshot.checklist.map((item, i) => (
                        <li key={i} className={cn(item.checked && "text-muted-foreground line-through")}>
                          {item.checked ? "☑" : "☐"} {item.text}
                        </li>
                      ))}
                    </ul>
                  )}
                  {res.snapshot.deadline && (
                    <p className="text-muted-foreground">Deadline: {formatWhen(res.snapshot.deadline)}</p>
                  )}
                </div>
              )}

              {canRestore && !isLatest && (
                <div className="border-t pt-3">
                  {!confirming ? (
                    <button
                      type="button"
                      onClick={() => setConfirming(true)}
                      className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-accent"
                    >
                      <RotateCcw size={13} /> Restore this version
                    </button>
                  ) : (
                    <div className="space-y-2 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs">
                      <p>
                        The card will go back to version {res.version}. This is saved as a new version, so nothing is lost.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={restoring}
                          onClick={restore}
                          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-bold text-primary-foreground disabled:opacity-60"
                        >
                          {restoring && <Loader2 size={12} className="animate-spin" />} Restore
                        </button>
                        <button
                          type="button"
                          disabled={restoring}
                          onClick={() => setConfirming(false)}
                          className="rounded-md px-3 py-1.5 font-semibold text-muted-foreground hover:bg-accent"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}
