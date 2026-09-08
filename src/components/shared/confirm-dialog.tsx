"use client";

import React, { useCallback, useState } from "react";
import { AlertTriangle } from "lucide-react";

export interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Defaults to true (destructive/red confirm button) — pass false for a neutral action. */
  danger?: boolean;
}

type ConfirmState = ConfirmOptions & { resolve: (value: boolean) => void };

/**
 * Promise-based replacement for `window.confirm(...)` that renders an app-styled modal instead
 * of the native browser dialog. Usage:
 *
 *   const { confirm, ConfirmDialog } = useConfirm();
 *   ...
 *   if (!(await confirm("Delete this task? This cannot be undone."))) return;
 *   ...
 *   return <>{ui}{ConfirmDialog}</>;
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const opts = typeof options === "string" ? { description: options } : options;
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve });
    });
  }, []);

  const close = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  const ConfirmDialog = state ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={() => close(false)}
    >
      <div
        className="w-full max-w-sm rounded-lg border bg-background shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3 p-5">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              state.danger === false ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            }`}
          >
            <AlertTriangle size={18} />
          </span>
          <div className="min-w-0 pt-0.5">
            <h3 className="text-sm font-bold text-foreground">{state.title || "Are you sure?"}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{state.description}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-5 py-3">
          <button
            type="button"
            onClick={() => close(false)}
            className="rounded-md border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
            autoFocus
          >
            {state.cancelLabel || "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors ${
              state.danger === false ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90"
            }`}
          >
            {state.confirmLabel || "Delete"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmDialog };
}
