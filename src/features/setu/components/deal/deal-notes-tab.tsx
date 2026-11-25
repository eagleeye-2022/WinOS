"use client";

import { useState } from "react";
import { EllipsisVertical, FileText, MessagesSquare, Pin, PinOff, Plus, SquarePen, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RichDescriptionEditor, RichDescriptionView, isEmptyDescription } from "@/components/shared/rich-description";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useClearPageDraft, usePageDraft, usePageViewState } from "@/lib/navigation/use-url-state";
import { useSetuStore } from "../../provider";
import type { DealNote, NoteCategory } from "../../types";
import { formatDate, formatTime, sortNotes } from "../../utils";
import { isBniNote } from "../../bni";
import { SETU_RICH_VIEW, SetuButton, attempt } from "../setu-ui";

/** Notes tab: header row with "Add Note" (opens the composer) + the notes feed. */
export function DealNotesTab({ dealId }: { dealId: string }) {
  const [adding, setAdding] = usePageViewState("DealNotes:adding", false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <h2 className="text-base font-semibold">Notes & Information</h2>
        <SetuButton variant="primary" size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus size={14} /> Add Note
        </SetuButton>
      </div>

      <NotesFeed
        dealId={dealId}
        category="NOTE"
        composerOpen={adding}
        onComposerClose={() => setAdding(false)}
        labels={{ form: "Add Note", title: "Enter note title or heading…", body: "Write a note about this client…", pin: "Pin this note to top" }}
        empty="No notes yet. Add the first one."
      />
    </div>
  );
}

interface FeedLabels {
  /** Composer heading; empty for none. */
  form: string;
  title: string;
  body: string;
  pin: string;
  /** Save button text (default "Save Note"). */
  save?: string;
}

/** Discussions tab: client queries and scope alignment, same feed as notes. */
export function DealDiscussionsTab({ dealId }: { dealId: string }) {
  const [adding, setAdding] = usePageViewState("DealDiscussions:adding", false);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <MessagesSquare size={20} className="setu-text-2" /> Discussions
        </h2>
        <SetuButton variant="primary" onClick={() => setAdding(true)} disabled={adding}>
          <Plus /> Add Discussion
        </SetuButton>
      </div>
      <NotesFeed
        dealId={dealId}
        category="DISCUSSION"
        composerOpen={adding}
        onComposerClose={() => setAdding(false)}
        labels={{
          form: "",
          title: "Enter discussion title or topic…",
          body: "Write a discussion note about this client or scope…",
          pin: "Pin this discussion to top",
          save: "Save Discussion",
        }}
        empty="No discussions yet."
        pinnedBadge
      />
    </div>
  );
}

/**
 * A deal's notes of one category, pinned first. The composer shows while `composerOpen`
 * (Notes opens it from a button; Negotiations keeps it always open).
 */
export function NotesFeed({
  dealId,
  category,
  composerOpen,
  onComposerClose,
  labels,
  empty,
  highlightPinned,
  pinnedBadge,
}: {
  dealId: string;
  category: NoteCategory;
  composerOpen: boolean;
  onComposerClose?: () => void;
  labels: FeedLabels;
  empty: string;
  /** Negotiations style: pinned card gets an accent border and its body sits in a panel; others show a dot. */
  highlightPinned?: boolean;
  /** Discussions style: a "Pinned" badge instead of the pin icon, and a pencil edit button. */
  pinnedBadge?: boolean;
}) {
  const allNotes = useSetuStore((s) => s.notes);
  const notes = sortNotes(allNotes.filter((n) => n.dealId === dealId && n.category === category && !isBniNote(n)));

  return (
    <div className="space-y-4">
      {composerOpen && <NoteComposer dealId={dealId} category={category} labels={labels} onDone={onComposerClose} />}
      {notes.length === 0 && !composerOpen ? (
        <div className="setu-card setu-text-2 px-6 py-12 text-center text-sm">{empty}</div>
      ) : (
        notes.map((n) => <NoteCard key={n.id} note={n} highlight={highlightPinned} pinnedBadge={pinnedBadge} />)
      )}
    </div>
  );
}

function NoteComposer({ dealId, category, labels, onDone }: { dealId: string; category: NoteCategory; labels: FeedLabels; onDone?: () => void }) {
  const form = `setu-${category.toLowerCase()}-${dealId}`;
  const [title, setTitle] = usePageDraft(form, "title", "");
  const [body, setBody] = usePageDraft(form, "body", "");
  const [pinned, setPinned] = usePageDraft(form, "pinned", false);
  const clearDraft = useClearPageDraft(form);
  const addNote = useSetuStore((s) => s.addNote);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const close = () => {
    clearDraft();
    setError("");
    onDone?.();
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isEmptyDescription(body)) {
      setError("Add a title and the text.");
      return;
    }
    if (saving) return;
    setSaving(true);
    const saved = await attempt(
      addNote(dealId, { title: title.trim(), body: body.trim(), pinned, category }),
      category === "NOTE" ? "Note saved" : category === "DISCUSSION" ? "Discussion saved" : "Update saved"
    );
    setSaving(false);
    if (saved) close();
  };

  return (
    <form onSubmit={save} className="setu-card space-y-4 px-6 py-5">
      {labels.form && (
        <h3 className={cn(category === "NOTE" ? "text-base font-semibold" : "text-xs font-bold uppercase tracking-wide")}>{labels.form}</h3>
      )}
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={labels.title} className="setu-input h-9" />
      <RichDescriptionEditor value={body} onChange={setBody} />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox checked={pinned} onCheckedChange={(v) => setPinned(v === true)} />
          {labels.pin}
        </label>
        <div className="flex gap-2">
          <SetuButton variant={onDone ? "secondary" : "ghost"} onClick={close}>
            Cancel
          </SetuButton>
          <SetuButton variant="primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : (labels.save ?? "Save Note")}
          </SetuButton>
        </div>
      </div>
    </form>
  );
}

function NoteCard({ note, highlight, pinnedBadge }: { note: DealNote; highlight?: boolean; pinnedBadge?: boolean }) {
  const updateNote = useSetuStore((s) => s.updateNote);
  const deleteNote = useSetuStore((s) => s.deleteNote);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);

  const startEdit = () => {
    setTitle(note.title);
    setBody(note.body);
    setEditing(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isEmptyDescription(body)) return;
    if ((await attempt(updateNote(note.id, { title: title.trim(), body: body.trim() }).then(() => true), "Saved")) === true) setEditing(false);
  };

  if (editing) {
    return (
      <form onSubmit={save} className="setu-card space-y-3 px-6 py-5">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="setu-input h-9 font-semibold" autoFocus />
        <RichDescriptionEditor value={body} onChange={setBody} />
        <div className="flex justify-end gap-2">
          <SetuButton onClick={() => setEditing(false)}>Cancel</SetuButton>
          <SetuButton variant="primary" type="submit" disabled={!title.trim() || isEmptyDescription(body)}>
            Save
          </SetuButton>
        </div>
      </form>
    );
  }

  const boxed = highlight && note.pinned;
  return (
    <article className={cn("setu-card px-6 py-5", boxed && "border-[var(--setu-accent-ring)] ring-1 ring-[var(--setu-accent-ring)]")}>
      <div className="flex items-start justify-between gap-4">
        <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold">
          {note.pinned && pinnedBadge ? (
            <span className="inline-flex items-center gap-1 rounded bg-[var(--setu-accent-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--setu-accent)]">
              <Pin size={11} className="fill-current" /> Pinned
            </span>
          ) : note.pinned ? (
            <Pin size={14} className="setu-accent-text shrink-0 fill-current" aria-label="Pinned" />
          ) : null}
          {note.title}
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          {pinnedBadge ? (
            <button type="button" onClick={startEdit} aria-label="Edit" title="Edit" className="setu-text-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-[var(--setu-soft)]">
              <SquarePen size={15} />
            </button>
          ) : (
            <button type="button" onClick={startEdit} className="setu-accent-text cursor-pointer px-2 text-xs font-semibold hover:underline">
              Edit
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Actions" className="setu-text-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-[var(--setu-soft)]">
                <EllipsisVertical size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void attempt(updateNote(note.id, { pinned: !note.pinned }), note.pinned ? "Unpinned" : "Pinned to top")}>
                {note.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                {note.pinned ? "Unpin" : "Pin to top"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onSelect={() => void attempt(deleteNote(note.id), "Deleted")}
              >
                <Trash2 size={14} /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <p className="setu-text-2 mt-1 text-xs">
        Added by <span className="font-medium text-[var(--setu-text)]">{note.authorName}</span> · {formatDate(note.createdAt)} - {formatTime(note.createdAt)}
      </p>
      <div className={cn("mt-3", boxed && "setu-soft px-4 py-3")}>
        <RichDescriptionView value={note.body} className={SETU_RICH_VIEW} />
      </div>
    </article>
  );
}
