"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorPicker } from "@/components/shared/color-picker";
import { createNote, type CreateNoteState } from "../actions/create-note";
import { createNotebook, type CreateNotebookState } from "../actions/create-notebook";
import type { NotebookData } from "../queries";

const TITLE_MAX = 120;
const CONTENT_MAX = 5000;

type NewNoteFormProps = { notebooks: NotebookData[] };

const initialNoteState: CreateNoteState = {};
const initialNotebookState: CreateNotebookState = {};

function toDatetimeLocal(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 16);
}

// ── Tag preview chips ─────────────────────────────────────────────────────────

function TagPreview({ raw }: { raw: string }) {
  const tags = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 pt-0.5">
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
          #{t}
        </span>
      ))}
    </div>
  );
}

// ── Checklist item editor ─────────────────────────────────────────────────────

function ChecklistEditor({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const update = (i: number, val: string) => {
    const next = [...items];
    next[i] = val;
    onChange(next);
  };
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const add = () => onChange([...items, ""]);

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 shrink-0 rounded-sm border border-muted-foreground/40" />
          <input
            name="item"
            value={item}
            onChange={(e) => update(i, e.target.value)}
            placeholder={`Item ${i + 1}`}
            className="flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          />
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-muted-foreground hover:text-destructive"
            >
              <XIcon size={13} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus size={12} />
        Add item
      </button>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function NewNoteForm({ notebooks }: NewNoteFormProps) {
  const [noteState, noteAction, notePending] = useActionState(createNote, initialNoteState);
  const [nbState, nbAction, nbPending] = useActionState(createNotebook, initialNotebookState);

  const formRef = useRef<HTMLFormElement>(null);
  const nbFormRef = useRef<HTMLFormElement>(null);

  const [type, setType] = useState<"TEXT" | "CHECKLIST">("TEXT");
  const [items, setItems] = useState<string[]>([""]);
  const [tagsRaw, setTagsRaw] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [showNewNotebook, setShowNewNotebook] = useState(false);

  useEffect(() => {
    if (noteState.message === "created") {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setType("TEXT");
      setItems([""]);
      setTagsRaw("");
      setSelectedColor("");
    }
  }, [noteState.message]);

  useEffect(() => {
    if (nbState.message === "created") {
      nbFormRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowNewNotebook(false);
    }
  }, [nbState.message]);

  const inputCls = "rounded-md border bg-background px-3 py-1.5 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60";
  const labelCls = "text-xs font-medium text-muted-foreground";

  return (
    <div className="flex flex-col gap-4">
      {/* Note type selector */}
      <div className="flex gap-1 rounded-md border p-0.5">
        {(["TEXT", "CHECKLIST"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              "flex-1 rounded py-1 text-xs font-medium transition-colors",
              type === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "TEXT" ? "Text" : "Checklist"}
          </button>
        ))}
      </div>

      <form ref={formRef} action={noteAction} className="flex flex-col gap-3">
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="color" value={selectedColor} />

        {/* Color */}
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Color <span className="font-normal opacity-60">(optional)</span></label>
          <ColorPicker value={selectedColor} onChange={setSelectedColor} />
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1">
          <input
            name="title"
            maxLength={TITLE_MAX}
            placeholder="Title"
            className={cn(inputCls, "font-medium", noteState.errors?.title && "border-destructive")}
          />
          {noteState.errors?.title && (
            <p className="text-xs text-destructive">{noteState.errors.title[0]}</p>
          )}
        </div>

        {/* Body — text or checklist */}
        {type === "TEXT" ? (
          <div className="flex flex-col gap-1">
            <textarea
              name="content"
              rows={4}
              maxLength={CONTENT_MAX}
              placeholder="Write your note…"
              className={cn("resize-none", inputCls, noteState.errors?.content && "border-destructive")}
            />
            {noteState.errors?.content && (
              <p className="text-xs text-destructive">{noteState.errors.content[0]}</p>
            )}
          </div>
        ) : (
          <ChecklistEditor items={items} onChange={setItems} />
        )}

        {/* Notebook */}
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Notebook</label>
          <div className="flex gap-1.5">
            <select
              name="notebookId"
              className={cn(inputCls, "flex-1 cursor-pointer")}
              defaultValue=""
            >
              <option value="">None</option>
              {notebooks.map((nb) => (
                <option key={nb.id} value={nb.id}>{nb.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewNotebook((v) => !v)}
              className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
              title="New notebook"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Tags</label>
          <input
            name="tags"
            placeholder="work, meeting, q3"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            className={inputCls}
          />
          <TagPreview raw={tagsRaw} />
        </div>

        {/* Reminder */}
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Reminder <span className="font-normal opacity-60">(optional)</span></label>
          <input
            name="reminderAt"
            type="datetime-local"
            defaultValue={toDatetimeLocal(null)}
            className={inputCls}
          />
        </div>

        <button
          type="submit"
          disabled={notePending}
          className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {notePending ? "Saving…" : "Add note"}
        </button>

        {noteState.message === "created" && (
          <p className="text-xs text-muted-foreground">Note saved.</p>
        )}
        {noteState.message === "Unauthorized" && (
          <p className="text-xs text-destructive">Session expired. Please sign in again.</p>
        )}
      </form>

      {/* Inline new-notebook form */}
      {showNewNotebook && (
        <form ref={nbFormRef} action={nbAction} className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3">
          <p className="text-xs font-medium">New notebook</p>
          <div className="flex gap-1.5">
            <input
              name="name"
              placeholder="Notebook name"
              maxLength={60}
              className={cn(inputCls, "flex-1", nbState.errors?.name && "border-destructive")}
            />
            <button
              type="submit"
              disabled={nbPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {nbPending ? "…" : "Create"}
            </button>
          </div>
          {nbState.errors?.name && (
            <p className="text-xs text-destructive">{nbState.errors.name[0]}</p>
          )}
        </form>
      )}
    </div>
  );
}
