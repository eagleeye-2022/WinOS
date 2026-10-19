"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquareText, X, Loader2 } from "lucide-react";

/**
 * Table cell for an effort log's task notes (stored as `remarks`): shows a one-line preview, and clicking it opens a popup
 * to read the full remarks and edit them (same look as the Project iNotes popup).
 * `onSave` may be sync or async; the popup closes once it resolves.
 */
export function RemarksPopupCell({
  value,
  onSave,
  subtitle,
  editable = true,
}: {
  value: string;
  onSave: (next: string) => void | Promise<unknown>;
  /** Context shown under the popup title, e.g. the task code and log title. */
  subtitle?: string;
  editable?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const open = () => {
    setDraft(value);
    setIsOpen(true);
  };
  const close = () => {
    if (!saving) setIsOpen(false);
  };
  const save = async () => {
    const trimmed = draft.trim();
    if (trimmed === value.trim()) {
      setIsOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setIsOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          open();
        }}
        title={value || (editable ? "Click to add task notes" : "No task notes")}
        className={`flex w-full min-w-[160px] max-w-[260px] items-center gap-1.5 truncate rounded px-1.5 py-1 text-left text-xs transition-colors hover:bg-accent cursor-pointer ${
          value ? "text-foreground" : "text-muted-foreground/60 italic"
        }`}
      >
        <MessageSquareText size={12} className={`shrink-0 ${value ? "text-primary" : "text-muted-foreground/40"}`} />
        <span className="truncate flex-1">{value || (editable ? "Add task notes" : "—")}</span>
      </button>

      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fixed inset-0" onClick={close} aria-hidden="true" />
            <div className="relative z-10 w-full max-w-lg space-y-4 rounded-xl border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between border-b pb-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <MessageSquareText size={16} className="text-primary" />
                    <h3 className="text-sm font-bold text-foreground">Task Notes</h3>
                  </div>
                  {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={close}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {editable ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        save();
                      } else if (e.key === "Escape") {
                        close();
                      }
                    }}
                    rows={8}
                    placeholder="Enter task notes for this effort log..."
                    className="min-h-[140px] w-full resize-y rounded-lg border border-input bg-background p-3 text-xs leading-relaxed text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/40"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Press <kbd className="rounded border bg-muted px-1 py-0.5 text-xs">Ctrl+Enter</kbd> to save
                    </span>
                    <span>{draft.length} characters</span>
                  </div>
                </div>
              ) : (
                <div className="min-h-[120px] max-h-[300px] overflow-y-auto rounded-lg border bg-muted/20 p-4">
                  {value ? (
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{value}</p>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">No task notes for this effort log.</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={close}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {editable ? "Cancel" : "Close"}
                </button>
                {editable && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={save}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving && <Loader2 size={12} className="animate-spin" />}
                    Save Task Notes
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
