"use client";

import React, { useState } from "react";
import { Check, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Keep in sync with APPROVAL_NOTE_MAX in the leave / attendance actions. */
export const APPROVAL_NOTE_MAX = 500;

interface ApproveNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "Approve leave request". */
  title?: string;
  /** Who / what is being approved, shown under the title. */
  description?: string;
  /** Resolves when the approval finished; the dialog closes on success. */
  onConfirm: (note: string) => Promise<boolean | void>;
}

/** Inline optional note above the Approve / Reject buttons — sent with whichever is clicked. */
export function ApprovalNoteField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="w-full space-y-1.5">
      <label htmlFor="approval-note" className="text-xs font-semibold text-foreground">
        Note <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <Textarea
        id="approval-note"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, APPROVAL_NOTE_MAX))}
        placeholder="Add a note for the team member…"
        rows={3}
        disabled={disabled}
        className="resize-none text-sm"
      />
      <p className="text-right text-[11px] tabular-nums text-muted-foreground">
        {value.length}/{APPROVAL_NOTE_MAX}
      </p>
    </div>
  );
}

/** The approver's note under an approval-flow step. */
export function StepNote({ note }: { note: string }) {
  return (
    <div className="mt-2 flex items-start gap-1.5 rounded-md bg-muted/60 px-2.5 py-2 text-xs text-foreground">
      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <p className="whitespace-pre-wrap break-words">{note}</p>
    </div>
  );
}

/** Approve with an optional note the member will see on their request. */
export function ApproveNoteDialog({
  open,
  onOpenChange,
  title = "Approve request",
  description,
  onConfirm,
}: ApproveNoteDialogProps) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const close = (next: boolean) => {
    if (busy) return;
    if (!next) setNote("");
    onOpenChange(next);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const ok = await onConfirm(note.trim());
      if (ok !== false) {
        setNote("");
        onOpenChange(false);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-1.5">
          <label htmlFor="approval-note" className="text-xs font-semibold text-foreground">
            Note <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="approval-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, APPROVAL_NOTE_MAX))}
            placeholder="Add a note for the team member…"
            rows={4}
            disabled={busy}
            className="resize-none text-sm"
          />
          <p className="flex justify-between text-[11px] text-muted-foreground">
            <span>The team member will see this note.</span>
            <span className="tabular-nums">
              {note.length}/{APPROVAL_NOTE_MAX}
            </span>
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => close(false)} className="h-9 text-xs font-semibold">
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={confirm}
            className="h-9 gap-1.5 bg-emerald-600 px-5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <Check className="h-4 w-4" />
            {busy ? "Approving…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
