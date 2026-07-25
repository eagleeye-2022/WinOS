"use client";

import { useState, useEffect } from "react";
import { useActionState } from "react";
import { Pin, PinOff, Pencil, Trash2, X, Check, Bell, Square, CheckSquare, Plus } from "lucide-react";
import { cn, toTitleCase } from "@/lib/utils";
import { ColorPicker } from "@/components/shared/color-picker";
import { DeleteConfirmBar } from "@/components/shared/delete-confirm-bar";
import type { NoteWithDetails } from "../queries";
import { updateNote } from "../actions/update-note";
import { deleteNote } from "../actions/delete-note";
import { togglePin } from "../actions/toggle-pin";
import { toggleChecklistItem } from "../actions/toggle-checklist-item";
import type { NotebookData } from "../queries";

const TITLE_MAX = 120;
const CONTENT_MAX = 5000;

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
}

function formatReminder(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

function toDatetimeLocal(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 16);
}

function contentPreview(content: string, max = 160) {
  if (content.length <= max) return content;
  return content.slice(0, max).trimEnd() + "…";
}

function isOverdue(date: Date) {
  return new Date(date) < new Date();
}

// ── Tag chip ──────────────────────────────────────────────────────────────────

function TagChip({ name }: { name: string }) {
  return (
    <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
      #{name}
    </span>
  );
}

// ── Checklist inline editor (used in edit mode) ───────────────────────────────

function ChecklistEditItems({ initial }: { initial: string[] }) {
  const [items, setItems] = useState(initial);
  const update = (i: number, v: string) => { const n = [...items]; n[i] = v; setItems(n); };
  const remove = (i: number) => setItems(items.filter((_, j) => j !== i));
  const add = () => setItems([...items, ""]);
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-sm border border-muted-foreground/40" />
          <input
            name="item"
            value={item}
            onChange={(e) => update(i, e.target.value)}
            placeholder={`Item ${i + 1}`}
            className="flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          />
          {items.length > 1 && (
            <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive">
              <X size={12} />
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground">
        <Plus size={11} /> Add item
      </button>
    </div>
  );
}

// ── ChecklistView (view mode) ─────────────────────────────────────────────────

// Each row gets its own component so useActionState is called at the top level
// of a component, never inside a .map() callback.
function ChecklistItemRow({ item }: { item: NoteWithDetails["checklistItems"][number] }) {
  const [, toggleAction, togglePending] = useActionState(toggleChecklistItem, {});
  return (
    <div className="flex items-start gap-2">
      <form action={toggleAction} className="mt-0.5 shrink-0">
        <input type="hidden" name="itemId" value={item.id} />
        <button
          type="submit"
          disabled={togglePending}
          className="text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          {item.checked
            ? <CheckSquare size={14} className="text-primary" />
            : <Square size={14} />}
        </button>
      </form>
      <span className={cn("text-sm leading-snug", item.checked && "text-muted-foreground line-through")}>
        {toTitleCase(item.text)}
      </span>
    </div>
  );
}

function ChecklistView({ items }: { items: NoteWithDetails["checklistItems"] }) {
  const shown = items.slice(0, 4);
  const rest = items.length - shown.length;
  return (
    <div className="flex flex-col gap-1">
      {shown.map((item) => <ChecklistItemRow key={item.id} item={item} />)}
      {rest > 0 && <p className="pl-5 text-xs text-muted-foreground">+{rest} more</p>}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

type NoteCardProps = {
  note: NoteWithDetails;
  showAuthor?: boolean;
  notebooks?: NotebookData[];
};

export function NoteCard({ note, showAuthor, notebooks = [] }: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [updateState, updateAction, updatePending] = useActionState(updateNote, {});
  const [deleteState, deleteAction, deletePending] = useActionState(deleteNote, {});
  const [, pinAction, pinPending] = useActionState(togglePin, {});

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (updateState.message === "updated") setEditing(false); }, [updateState.message]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (deleteState.message && deleteState.message !== "deleted") setConfirmingDelete(false);
  }, [deleteState.message]);

  const iconBtn = "rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40";
  const inputCls = "rounded-md border bg-background px-3 py-1.5 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring";
  const labelCls = "text-xs font-medium text-muted-foreground";

  const currentTagsStr = note.tags.map((t) => t.tag.name).join(", ");
  const currentItems = note.checklistItems.map((i) => i.text);
  const [editColor, setEditColor] = useState(note.color ?? "");

  // ── Edit mode ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <article className={cn("flex flex-col gap-3 rounded-lg border bg-card p-5 text-card-foreground", note.isPinned && "border-primary/40")}>
        <form action={updateAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={note.id} />
          <input type="hidden" name="noteType" value={note.type} />
          <input type="hidden" name="color" value={editColor} />

          <div className="flex flex-col gap-1">
            <input name="title" defaultValue={note.title} maxLength={TITLE_MAX}
              className={cn(inputCls, "font-medium", updateState.errors?.title && "border-destructive")} />
            {updateState.errors?.title && <p className="text-xs text-destructive">{updateState.errors.title[0]}</p>}
          </div>

          {note.type === "TEXT" ? (
            <div className="flex flex-col gap-1">
              <textarea name="content" defaultValue={note.content} rows={5} maxLength={CONTENT_MAX}
                className={cn("resize-none", inputCls, updateState.errors?.content && "border-destructive")} />
              {updateState.errors?.content && <p className="text-xs text-destructive">{updateState.errors.content[0]}</p>}
            </div>
          ) : (
            <ChecklistEditItems initial={currentItems} />
          )}

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Notebook</label>
            <select name="notebookId" defaultValue={note.notebookId ?? ""} className={cn(inputCls, "cursor-pointer")}>
              <option value="">None</option>
              {notebooks.map((nb) => <option key={nb.id} value={nb.id}>{nb.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Tags</label>
            <input name="tags" defaultValue={currentTagsStr} placeholder="work, meeting" className={inputCls} />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Reminder <span className="font-normal opacity-60">(optional)</span></label>
            <input name="reminderAt" type="datetime-local" defaultValue={toDatetimeLocal(note.reminderAt)} className={inputCls} />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Color <span className="font-normal opacity-60">(optional)</span></label>
            <ColorPicker value={editColor} onChange={setEditColor} />
          </div>

          <div className="flex items-center gap-2">
            <button type="submit" disabled={updatePending}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
              <Check size={12} /> {updatePending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent">
              <X size={12} /> Cancel
            </button>
          </div>

          {updateState.message === "Not found" && (
            <p className="text-xs text-destructive">Note not found or you don&apos;t have permission to edit it.</p>
          )}
        </form>
      </article>
    );
  }

  // ── View mode ──────────────────────────────────────────────────────────────
  const reminderSet = note.reminderAt !== null;
  const reminderOverdue = reminderSet && isOverdue(note.reminderAt!);

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-5 text-card-foreground",
        note.color ? undefined : "bg-card",
        note.isPinned && "border-primary/40",
        !note.color && note.isPinned && "bg-primary/3"
      )}
      style={note.color ? { backgroundColor: note.color } : undefined}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-sm font-semibold leading-snug">{toTitleCase(note.title)}</h3>
          {note.notebook && (
            <span
              className="self-start rounded px-1.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: note.notebook.color ?? "#e5e7eb", color: "#374151" }}
            >
              {note.notebook.name}
            </span>
          )}
        </div>

        {!confirmingDelete && (
          <div className="flex shrink-0 items-center">
            <form action={pinAction}>
              <input type="hidden" name="id" value={note.id} />
              <input type="hidden" name="isPinned" value={String(note.isPinned)} />
              <button type="submit" disabled={pinPending} title={note.isPinned ? "Unpin" : "Pin"} className={iconBtn}>
                {note.isPinned ? <PinOff size={13} /> : <Pin size={13} />}
              </button>
            </form>
            <button type="button" onClick={() => setEditing(true)} title="Edit" className={iconBtn}><Pencil size={13} /></button>
            <button type="button" onClick={() => setConfirmingDelete(true)} title="Delete"
              className={cn(iconBtn, "hover:text-destructive")}><Trash2 size={13} /></button>
          </div>
        )}
      </div>

      {/* Pinned badge */}
      {note.isPinned && (
        <span className="self-start rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-primary">
          Pinned
        </span>
      )}

      {/* Body */}
      {note.type === "TEXT" ? (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {contentPreview(note.content)}
        </p>
      ) : (
        <ChecklistView items={note.checklistItems} />
      )}

      {/* Tags */}
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {note.tags.map(({ tag }) => <TagChip key={tag.id} name={tag.name} />)}
        </div>
      )}

      {/* Reminder */}
      {reminderSet && (
        <div className={cn(
          "flex items-center gap-1.5 text-xs",
          reminderOverdue ? "text-destructive" : "text-muted-foreground"
        )}>
          <Bell size={11} />
          <span>{formatReminder(note.reminderAt!)}</span>
          {reminderOverdue && <span className="font-medium">(overdue)</span>}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmingDelete && (
        <DeleteConfirmBar
          message="Delete this note?"
          action={deleteAction}
          id={note.id}
          pending={deletePending}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      {deleteState.message && deleteState.message !== "deleted" && (
        <p className="text-xs text-destructive">
          {deleteState.message === "Not found"
            ? "Note not found or you don't have permission to delete it."
            : "Something went wrong. Please try again."}
        </p>
      )}

      {/* Footer */}
      {showAuthor && (
        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>{note.author.name ?? note.author.email}</span>
        </div>
      )}
    </article>
  );
}
