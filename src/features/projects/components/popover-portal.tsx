"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface AnchoredPopoverProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Extra classes on the portaled wrapper (width, etc). Position is computed inline. */
  className?: string;
  /** "left" (default) aligns the popover's left edge with the trigger; "right" aligns right edges
   *  — use "right" for triggers near the right edge of a horizontally-scrolling table. */
  align?: "left" | "right";
}

/** Portals popover content to `document.body` and positions it with `fixed` coordinates computed
 *  from the trigger's bounding rect. Table cells (`renderLeafCell` in all-projects-table-view.tsx)
 *  set `overflow-hidden` for text truncation, which also clips any `position: absolute` descendant
 *  the moment it would extend past the cell — that clipped the assignee/calendar popovers into an
 *  unreadable sliver. A portaled `fixed` element escapes that clipping box entirely. Closes on
 *  outside click, Escape, or any ancestor scroll (the anchor rect would otherwise go stale) — but
 *  not on scrolling *inside* the popover itself (e.g. the member list). */
export function AnchoredPopover({
  anchorRef,
  isOpen,
  onClose,
  children,
  className = "",
  align = "left",
}: AnchoredPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) {
      setCoords(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 4,
      left: rect.left,
      right: window.innerWidth - rect.right,
    });
  }, [isOpen, anchorRef]);

  useEffect(() => {
    if (!isOpen) return;

    function isInside(node: Node | null) {
      return (
        (popoverRef.current && node && popoverRef.current.contains(node)) ||
        (anchorRef.current && node && anchorRef.current.contains(node))
      );
    }

    function handlePointerDown(e: MouseEvent) {
      if (!isInside(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleScroll(e: Event) {
      // Ignore scrolling inside the popover's own content (e.g. a scrollable member list) —
      // only close when something outside it (the table, the page) scrolls the anchor away.
      if (popoverRef.current && e.target instanceof Node && popoverRef.current.contains(e.target)) return;
      onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || !coords || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: coords.top,
        ...(align === "right" ? { right: coords.right } : { left: coords.left }),
      }}
      className={`z-50 rounded-lg border bg-popover shadow-2xl overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-100 ${className}`}
    >
      {children}
    </div>,
    document.body
  );
}
