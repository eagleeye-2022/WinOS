"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, CheckSquare, Loader2, NotebookPen, Pencil, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditNoteModal } from "@/features/notes/components/edit-note-modal";
import {
  getProjectNotesAction,
  type ProjectNoteCard,
  type ProjectNoteSummary,
  type ProjectNotesResult,
} from "../actions/project-notes-actions";

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

type EditableCard = {
  id: string;
  title: string | null;
  content: string;
  color: string | null;
  deadline: Date | null;
  checklistItems: { id?: string; text: string; checked?: boolean }[];
  canEdit: boolean;
};

function NoteCardView({ note, onOpen }: { note: ProjectNoteCard; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      /* Fixed 240×240 card: title and footer always visible; the body in between is clipped. */
      className="group flex h-[240px] w-[240px] shrink-0 flex-col gap-2 overflow-hidden rounded-lg border border-l-4 bg-background p-3 text-left shadow-2xs transition-shadow hover:shadow-md"
      style={{ borderLeftColor: note.color && note.color !== "#ffffff" ? note.color : "#3b82f6" }}
    >
      <div className="flex shrink-0 items-start justify-between gap-2">
        <p className="line-clamp-2 text-xs font-bold leading-snug text-foreground">{note.title || "Untitled Note"}</p>
        {note.canEdit && (
          <Pencil size={12} className="mt-0.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      {note.content && (
        <div
          className="html-content line-clamp-6 overflow-hidden text-[11px] leading-relaxed text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: note.content }}
        />
      )}
      {note.checklistItems.length > 0 && (
        <div className="flex flex-col gap-1 border-t pt-2">
          {note.checklistItems.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center gap-1.5 text-[11px]">
              {item.checked ? (
                <CheckSquare size={12} className="shrink-0 text-primary" />
              ) : (
                <Square size={12} className="shrink-0 text-muted-foreground" />
              )}
              <span className={cn("truncate", item.checked && "text-muted-foreground line-through")}>{item.text}</span>
            </div>
          ))}
          {note.checklistItems.length > 5 && (
            <span className="text-[10px] text-muted-foreground">+{note.checklistItems.length - 5} more items</span>
          )}
        </div>
      )}
      {note.deadline && (
        <span className="flex w-fit items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
          <Calendar size={10} /> Due {formatDate(note.deadline)}
        </span>
      )}
      </div>
      <div className="mt-auto flex shrink-0 flex-col gap-0.5 border-t pt-2 text-[10px] text-muted-foreground/80">
        <span className="truncate">
          {note.authorName}
          {note.source ? ` · ${note.source}` : ""}
        </span>
        <span>Updated {formatDate(note.updatedAt)}</span>
      </div>
    </button>
  );
}

/** iNotes cards shared to one project. Members read; managers (and authors) edit in place. */
export function ProjectINotesPanel({
  projectId,
  className,
}: {
  /** Project id or code. */
  projectId: string;
  className?: string;
}) {
  const [data, setData] = useState<ProjectNotesResult | null>(null);
  const [editing, setEditing] = useState<EditableCard | null>(null);

  const reload = useCallback(async () => {
    setData(await getProjectNotesAction(projectId));
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    getProjectNotesAction(projectId).then((res) => {
      if (!cancelled) setData(res);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!data) {
    return (
      <div className={cn("flex items-center justify-center p-10", className)}>
        <Loader2 size={22} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!data.success) {
    return <div className={cn("p-6 text-sm text-muted-foreground", className)}>{data.error}</div>;
  }

  const open = (n: ProjectNoteCard) =>
    setEditing({
      id: n.id,
      title: n.title,
      content: n.content,
      color: n.color,
      deadline: n.deadline ? new Date(n.deadline) : null,
      checklistItems: n.checklistItems.map((c) => ({ id: c.id, text: c.text, checked: c.checked })),
      canEdit: n.canEdit,
    });

  return (
    <div className={cn("flex flex-col gap-4 overflow-y-auto", className)}>
      <p className="text-xs text-muted-foreground">
        {data.cards.length} shared card{data.cards.length === 1 ? "" : "s"}
        {data.isManager ? " · You can edit these as a manager" : " · View only"}
      </p>

      {data.cards.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
          No cards have been shared to this project yet. In{" "}
          <Link href="/notes" className="font-semibold text-primary hover:underline">
            iNotes
          </Link>
          , open a card&apos;s actions and choose &quot;Share to Project&quot;.
        </div>
      ) : (
        // Cards size to their content (up to 240px) and wrap onto the next line when there are more.
        <div className="flex flex-wrap items-start gap-3">
          {data.cards.map((note) => (
            <NoteCardView key={note.id} note={note} onOpen={() => open(note)} />
          ))}
        </div>
      )}

      {editing && (
        <EditNoteModal
          note={editing}
          onNoteChange={setEditing}
          canEdit={editing.canEdit}
          onClose={() => setEditing(null)}
          onSaved={reload}
          showTimeline
        />
      )}
    </div>
  );
}

/**
 * "Project iNotes" cell for the All Projects table: the latest shared card's title (+N more), or
 * "No notes shared". Clicking opens every shared card in a modal.
 */
export function ProjectINotesCell({
  projectId,
  projectName,
  summary,
  loaded,
  onClosed,
}: {
  projectId: string;
  projectName: string;
  /** undefined once loaded → the viewer can't read this project's notes. */
  summary: ProjectNoteSummary | undefined;
  /** False while summaries are still being fetched. */
  loaded: boolean;
  /** Called when the modal closes, so the table can refresh the title/count. */
  onClosed?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
    onClosed?.();
  };

  if (!loaded) {
    return <span className="block px-1.5 py-1 text-[11px] text-muted-foreground/50">…</span>;
  }
  if (!summary) {
    return <span className="block px-1.5 py-1 text-[11px] text-muted-foreground/60">—</span>;
  }

  const hasNotes = summary.count > 0;
  const title = summary.latestTitle || "Untitled Note";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={hasNotes ? `${summary.count} card${summary.count === 1 ? "" : "s"} shared · click to view` : "No notes shared"}
        className={cn(
          "flex w-full min-w-0 items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] transition-colors hover:bg-accent cursor-pointer",
          hasNotes ? "font-medium text-foreground" : "italic text-muted-foreground/60"
        )}
      >
        <NotebookPen size={12} className={cn("shrink-0", hasNotes ? "text-primary" : "text-muted-foreground/40")} />
        <span className="min-w-0 flex-1 truncate">{hasNotes ? title : "No notes shared"}</span>
        {summary.count > 1 && (
          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
            +{summary.count - 1}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={close} aria-hidden="true" />
          {/* Width fits the cards (auto), up to max-w-5xl; beyond that the cards wrap onto new lines. */}
          <div className="relative z-10 flex max-h-[85vh] w-auto min-w-[320px] max-w-5xl flex-col rounded-xl border bg-card p-5 shadow-2xl">
            <div className="mb-3 flex items-start justify-between border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <NotebookPen size={16} className="text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Project iNotes</h3>
                </div>
                <p className="text-[11px] text-muted-foreground">{projectName}</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
            <ProjectINotesPanel projectId={projectId} className="min-h-0 flex-1" />
          </div>
        </div>
      )}
    </>
  );
}
