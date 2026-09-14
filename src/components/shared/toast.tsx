"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<ToastListener>();

function notify() {
  listeners.forEach((listener) => listener([...toasts]));
}

export const toast = {
  success(message: string, duration = 3500) {
    toast.show("success", message, duration);
  },
  error(message: string, duration = 4500) {
    toast.show("error", message, duration);
  },
  info(message: string, duration = 3500) {
    toast.show("info", message, duration);
  },
  warning(message: string, duration = 4000) {
    toast.show("warning", message, duration);
  },
  show(type: ToastType, message: string, duration = 3500) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newToast: ToastItem = { id, type, message, duration };
    toasts = [...toasts, newToast];
    notify();

    if (duration > 0) {
      setTimeout(() => {
        toast.dismiss(id);
      }, duration);
    }
    return id;
  },
  dismiss(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  },
  clear() {
    toasts = [];
    notify();
  },
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm w-full"
    >
      {items.map((item) => {
        const isSuccess = item.type === "success";
        const isError = item.type === "error";
        const isWarning = item.type === "warning";

        return (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 text-xs font-medium shadow-xl backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-3 fade-in ${
              isSuccess
                ? "border-emerald-500/30 bg-emerald-950/90 text-emerald-100 dark:bg-emerald-950/95 dark:text-emerald-200"
                : isError
                ? "border-destructive/40 bg-destructive/95 text-destructive-foreground"
                : isWarning
                ? "border-amber-500/30 bg-amber-950/90 text-amber-100 dark:bg-amber-950/95 dark:text-amber-200"
                : "border-border bg-card/95 text-foreground dark:bg-popover/95"
            }`}
          >
            <div className="shrink-0">
              {isSuccess && <CheckCircle2 size={16} className="text-emerald-400" />}
              {isError && <AlertCircle size={16} className="text-rose-300" />}
              {isWarning && <AlertTriangle size={16} className="text-amber-400" />}
              {!isSuccess && !isError && !isWarning && <Info size={16} className="text-primary" />}
            </div>
            <p className="flex-1 leading-snug break-words">{item.message}</p>
            <button
              type="button"
              onClick={() => toast.dismiss(item.id)}
              className="shrink-0 rounded p-1 opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Close notification"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
