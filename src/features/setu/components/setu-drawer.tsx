"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Right-side drawer for every Setu create / add / edit form, in the same shell as the app's other
 * drawers (projects' Add Task / Add Project): blurred overlay, full-height panel sliding in from the
 * right, `border-b` header with a bold title and a close button, scrolling body, actions at the
 * bottom. Built on the Radix dialog so Escape, focus trapping and stacked drawers keep working.
 * Colours come from the app theme (`bg-background`, `border`, `primary`), see `.setu-drawer` in
 * setu.css.
 */
export function SetuDrawer({
  open,
  onClose,
  title,
  description,
  badge,
  width = "max-w-xl",
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** Small muted line under the title (names, counts, dates). Screen-reader only when absent. */
  description?: React.ReactNode;
  /** Pill next to the title. */
  badge?: React.ReactNode;
  /** Panel width class (default `max-w-xl`, like the app's Add Task drawer). */
  width?: string;
  /** Action row pinned under the scrolling body. Forms that hold their own footer leave this out. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-xs data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "setu-scope setu-drawer fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l border-border bg-background text-foreground shadow-2xl outline-none",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-300 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=closed]:duration-200",
            width
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <DialogPrimitive.Title className="text-lg font-bold text-foreground">{title}</DialogPrimitive.Title>
                {badge}
              </div>
              <DialogPrimitive.Description className={cn("mt-0.5 text-xs text-muted-foreground", !description && "sr-only")}>
                {description || title}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X size={18} />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && <div className="setu-drawer-footer flex flex-wrap items-center gap-3 border-t border-border px-6 py-4">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
