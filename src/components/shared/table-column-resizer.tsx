"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Excel-style column resizing for every table and column layout in the app, mounted once in the
 * dashboard layout.
 *
 * Hover the right edge of any header cell → col-resize cursor and a guide line; drag to resize
 * that column; double-click the edge to reset it to automatic width. Widths are remembered per
 * page in this browser (localStorage — a viewer convenience, safe to lose).
 *
 * Works purely with document-level pointer listeners and inline styles on the <th>, so it never
 * injects nodes into React-rendered tables. Opt a table out with `data-no-col-resize`; header
 * cells spanning several columns (group headers) are skipped.
 *
 * Column layouts that aren't <table>s (Kanban boards, team columns, CSS grids) opt in by marking
 * the column element `data-resizable-col` with a stable `data-col-key`: its right edge drags the
 * same way, and its width is also exposed as `--colw-<key>` on the nearest `[data-col-scope]`
 * (e.g. for a grid's `gridTemplateColumns`).
 */

type ResizableEl = HTMLElement;

const RESIZABLE_SELECTOR = "th, [data-resizable-col]";

const EDGE_PX = 6;
const MIN_WIDTH = 48;
const STORAGE_PREFIX = "winos:colw:";

function storageKey(pathname: string) {
  return `${STORAGE_PREFIX}${pathname}`;
}

function readWidths(pathname: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(pathname)) || "{}");
  } catch {
    return {};
  }
}

function writeWidths(pathname: string, widths: Record<string, number>) {
  try {
    if (Object.keys(widths).length === 0) localStorage.removeItem(storageKey(pathname));
    else localStorage.setItem(storageKey(pathname), JSON.stringify(widths));
  } catch {
    /* storage unavailable — resizing still works for this visit */
  }
}

const isTh = (el: Element): el is HTMLTableCellElement => el.tagName === "TH";

/** Element whose width variable / guide line is scoped to: the table, or a `[data-col-scope]`. */
function scopeOf(el: ResizableEl): HTMLElement | null {
  return el.closest<HTMLElement>("table, [data-col-scope]");
}

/** Resizable column under the pointer when the pointer is on its right-edge resize zone. */
function resizableEdgeAt(e: PointerEvent | MouseEvent): ResizableEl | null {
  const target = e.target as Element | null;
  const el = target?.closest?.<HTMLElement>(RESIZABLE_SELECTOR) ?? null;
  if (!el) return null;
  if (isTh(el)) {
    if (el.colSpan > 1) return null;
    const table = el.closest("table");
    if (!table || table.hasAttribute("data-no-col-resize")) return null;
  } else if (!el.dataset.colKey) {
    return null;
  }
  const rect = el.getBoundingClientRect();
  return e.clientX >= rect.right - EDGE_PX && e.clientX <= rect.right + 1 ? el : null;
}

/** Stable id within the page: table index + header row + cell index, or the explicit col key. */
function cellId(el: ResizableEl): string | null {
  if (!isTh(el)) return el.dataset.colKey ? `k:${el.dataset.colKey}` : null;
  const table = el.closest("table");
  const row = el.parentElement as HTMLTableRowElement | null;
  if (!table || !row) return null;
  const tableIndex = Array.prototype.indexOf.call(document.querySelectorAll("table"), table);
  return `${tableIndex}:${row.rowIndex}:${el.cellIndex}`;
}

/** Narrowest a column may be dragged to: its `data-min-width` (e.g. Kanban task lists), else MIN_WIDTH. */
function minWidthOf(el: ResizableEl): number {
  const own = Number(el.dataset.minWidth);
  return Number.isFinite(own) && own > 0 ? own : MIN_WIDTH;
}

function applyWidth(el: ResizableEl, rawWidth: number | null) {
  // Also clamps widths saved before a column had a minimum.
  const width = rawWidth === null ? null : Math.max(minWidthOf(el), rawWidth);
  const value = width === null ? "" : `${width}px`;
  el.style.width = value;
  el.style.minWidth = value;
  el.style.maxWidth = value;
  // Flex columns (boards) otherwise grow/shrink away from the dragged width.
  if (!isTh(el)) el.style.flex = width === null ? "" : `0 0 ${value}`;
  // Layouts whose cells pin content to a fixed width can follow the resize: a column with
  // `data-col-key="x"` exposes its width as `--colw-x` on its table / [data-col-scope].
  const key = el.dataset.colKey;
  const scope = scopeOf(el);
  if (key && scope) {
    if (width === null) scope.style.removeProperty(`--colw-${key}`);
    else scope.style.setProperty(`--colw-${key}`, value);
  }
}

export function TableColumnResizer() {
  const pathname = usePathname();

  // Re-apply remembered widths whenever tables (re)render on this page.
  useEffect(() => {
    let frame = 0;
    const apply = () => {
      frame = 0;
      // Read fresh each pass so widths set by a drag on this visit also survive re-renders.
      const saved = readWidths(pathname);
      if (Object.keys(saved).length === 0) return;
      for (const el of document.querySelectorAll<HTMLElement>(RESIZABLE_SELECTOR)) {
        const id = cellId(el);
        if (!id || !saved[id]) continue;
        const target = Math.max(minWidthOf(el), saved[id]);
        if (el.style.width !== `${target}px`) applyWidth(el, target);
      }
    };
    apply();
    const observer = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(apply);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => {
    const guide = document.createElement("div");
    guide.setAttribute("aria-hidden", "true");
    Object.assign(guide.style, {
      position: "fixed",
      top: "0",
      width: "2px",
      background: "var(--primary)",
      opacity: "0.7",
      pointerEvents: "none",
      zIndex: "9999",
      display: "none",
    });
    document.body.appendChild(guide);

    let drag: { th: ResizableEl; startX: number; startWidth: number } | null = null;
    let suppressClick = false;

    const showGuide = (el: ResizableEl, x: number) => {
      const area = (scopeOf(el) ?? el).getBoundingClientRect();
      guide.style.left = `${x - 1}px`;
      guide.style.top = `${area.top}px`;
      guide.style.height = `${Math.min(area.height, window.innerHeight - area.top)}px`;
      guide.style.display = "block";
    };
    const hideGuide = () => {
      guide.style.display = "none";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (drag) {
        const width = Math.max(minWidthOf(drag.th), drag.startWidth + (e.clientX - drag.startX));
        applyWidth(drag.th, width);
        showGuide(drag.th, drag.th.getBoundingClientRect().right);
        return;
      }
      const th = resizableEdgeAt(e);
      document.documentElement.style.cursor = th ? "col-resize" : "";
      if (th) showGuide(th, th.getBoundingClientRect().right);
      else hideGuide();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const th = resizableEdgeAt(e);
      if (!th) return;
      // Don't start a text selection or trigger the header's own click (e.g. sorting).
      e.preventDefault();
      e.stopPropagation();
      drag = { th, startX: e.clientX, startWidth: th.getBoundingClientRect().width };
      document.body.style.userSelect = "none";
      // Columns with `transition-all` would otherwise lag behind the pointer.
      th.style.transition = "none";
    };

    const onPointerUp = () => {
      if (!drag) return;
      const { th } = drag;
      drag = null;
      suppressClick = true;
      th.style.transition = "";
      document.body.style.userSelect = "";
      hideGuide();
      const id = cellId(th);
      if (id) {
        const widths = readWidths(window.location.pathname);
        widths[id] = Math.round(th.getBoundingClientRect().width);
        writeWidths(window.location.pathname, widths);
      }
    };

    // Swallow the click that ends a drag so header sort/toggle handlers don't fire.
    const onClick = (e: MouseEvent) => {
      if (suppressClick) {
        suppressClick = false;
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onDoubleClick = (e: MouseEvent) => {
      const th = resizableEdgeAt(e);
      if (!th) return;
      e.preventDefault();
      e.stopPropagation();
      applyWidth(th, null);
      const id = cellId(th);
      if (id) {
        const widths = readWidths(window.location.pathname);
        delete widths[id];
        writeWidths(window.location.pathname, widths);
      }
    };

    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("dblclick", onDoubleClick, true);
    return () => {
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("dblclick", onDoubleClick, true);
      document.documentElement.style.cursor = "";
      document.body.style.userSelect = "";
      guide.remove();
    };
  }, []);

  return null;
}
