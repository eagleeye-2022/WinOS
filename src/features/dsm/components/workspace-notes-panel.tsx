"use client";

import { useActionState } from "react";
import {
  MoreVertical,
  Bold,
  Italic,
  Underline,
  List,
  CheckSquare,
  Type,
  Lightbulb,
  Link2,
  Paperclip,
} from "lucide-react";
import { toggleActionItem, type ToggleActionItemState } from "../actions/toggle-action-item";
import type { WorkspaceNoteData } from "../queries";

// ── Action item row ───────────────────────────────────────────────────────────

function ActionItemRow({ id, checked, text }: { id: string; checked: boolean; text: string }) {
  const [, action, pending] = useActionState<ToggleActionItemState, FormData>(
    toggleActionItem,
    {}
  );

  return (
    <form action={action} className="flex items-start gap-2.5">
      <input type="hidden" name="itemId" value={id} />
      <button
        type="submit"
        disabled={pending}
        aria-label={checked ? "Mark incomplete" : "Mark complete"}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-60 ${
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background hover:border-primary/60"
        }`}
      >
        {checked && (
          <svg
            viewBox="0 0 8 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-2.5 w-2.5"
          >
            <polyline points="1,4 3,6 7,2" />
          </svg>
        )}
      </button>
      <span
        className={`text-sm leading-relaxed ${
          checked ? "text-muted-foreground line-through" : "text-foreground"
        }`}
      >
        {text}
      </span>
    </form>
  );
}

// ── Toolbar button ────────────────────────────────────────────────────────────

const TOOLBAR_ICONS = [
  [Bold, Italic, Underline],
  [List, CheckSquare],
  [Type, Lightbulb, Link2, Paperclip],
] as const;

function Toolbar() {
  return (
    <div className="flex items-center gap-0.5 border-b px-3 py-2">
      {TOOLBAR_ICONS.map((group, gi) => (
        <div key={gi} className="flex items-center">
          {gi > 0 && <div className="mx-1 h-4 w-px bg-border" />}
          {group.map((Icon, ii) => (
            <button
              key={ii}
              type="button"
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent"
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

type WorkspaceNotesPanelProps = {
  note: WorkspaceNoteData | null;
  canEdit?: boolean;
};

function timeAgo(date: Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "Just updated";
  if (mins < 60) return `Edited ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Edited ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `Edited ${days}d ago`;
}

export function WorkspaceNotesPanel({ note, canEdit = false }: WorkspaceNotesPanelProps) {
  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-base font-bold">Workspace Notes</span>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent"
        >
          <MoreVertical size={16} />
        </button>
      </div>

      {!note ? (
        <>
          {canEdit && <Toolbar />}
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            No workspace note yet.
            <br />
            Your manager will add team focus here.
          </div>
        </>
      ) : (
        <>
          <Toolbar />

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* Author */}
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {(note.owner.name ?? note.owner.email).slice(0, 2).toUpperCase()}
              </span>
              <div>
                <p className="text-sm font-medium leading-tight">
                  {note.owner.name ?? note.owner.email.split("@")[0]}
                </p>
                <p className="text-xs text-muted-foreground">{timeAgo(note.updatedAt)}</p>
              </div>
            </div>

            {/* Title */}
            <h2 className="mb-3 text-2xl font-bold leading-tight">{note.title}</h2>

            {/* Body */}
            <p className="mb-5 text-sm leading-relaxed text-foreground">{note.body}</p>

            {/* Action items */}
            {note.actionItems.length > 0 && (
              <div className="mb-5">
                <h3 className="mb-3 text-sm font-semibold text-primary">Action Items</h3>
                <div className="flex flex-col gap-2.5">
                  {note.actionItems.map((item) =>
                    canEdit ? (
                      <ActionItemRow
                        key={item.id}
                        id={item.id}
                        checked={item.checked}
                        text={item.text}
                      />
                    ) : (
                      <div key={item.id} className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            item.checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background"
                          }`}
                        >
                          {item.checked && (
                            <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-2.5 w-2.5">
                              <polyline points="1,4 3,6 7,2" />
                            </svg>
                          )}
                        </span>
                        <span className={`text-sm leading-relaxed ${item.checked ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {item.text}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Key note callout */}
            {note.keyNote && (
              <div className="rounded-md border-l-4 border-primary/50 bg-primary/5 px-4 py-3">
                <p className="mb-1 text-xs font-semibold text-primary">Key Note:</p>
                <p className="text-sm leading-relaxed">{note.keyNote}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
