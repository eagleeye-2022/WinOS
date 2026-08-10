"use client";

import { AlertTriangle, Loader2 } from "lucide-react";

type DeleteConfirmBarProps = {
  /** Confirmation prompt shown to the user. */
  message: string;
  /** The dispatch function returned by useActionState — passed directly to form action. */
  action: (payload: FormData) => void;
  /** Record id forwarded as a hidden input named "id". */
  id: string;
  pending: boolean;
  onCancel: () => void;
};

export function DeleteConfirmBar({
  message,
  action,
  id,
  pending,
  onCancel,
}: DeleteConfirmBarProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
      <AlertTriangle size={13} className="shrink-0 text-destructive" />
      <span className="flex-1 text-xs text-destructive">{message}</span>
      <form action={action} className="flex items-center gap-1.5">
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-1.5 rounded bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending && <Loader2 size={12} className="animate-spin" />}
          {pending ? "Deleting…" : "Delete"}
        </button>
      </form>
      <button
        type="button"
        onClick={onCancel}
        className="rounded border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent"
      >
        Cancel
      </button>
    </div>
  );
}
