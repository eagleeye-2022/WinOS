"use client";

import type { ScrollEntry } from "@/stores/navigation-store";

// Scroll containers in WinOS are nested divs inside <main> (main itself is overflow-hidden),
// so window-level scroll restoration doesn't help. A container is identified by its
// `data-scroll-key` attribute when present (stable — prefer it on important lists), otherwise by
// its child-index path from the nav root, which is stable as long as the view re-renders the
// same structure.

const PATH_PREFIX = "p:";

export function scrollKeyFor(el: Element, root: Element): string | null {
  const explicit = el.getAttribute("data-scroll-key");
  if (explicit) return explicit;
  const indices: number[] = [];
  let node: Element | null = el;
  while (node && node !== root) {
    const parent: Element | null = node.parentElement;
    if (!parent) return null;
    indices.unshift(Array.prototype.indexOf.call(parent.children, node));
    node = parent;
  }
  return node === root ? `${PATH_PREFIX}${indices.join("/")}` : null;
}

export function findScrollElement(root: Element, key: string): Element | null {
  if (!key.startsWith(PATH_PREFIX)) {
    return root.querySelector(`[data-scroll-key="${CSS.escape(key)}"]`);
  }
  const path = key.slice(PATH_PREFIX.length);
  let node: Element | null = root;
  for (const part of path ? path.split("/") : []) {
    node = node?.children[Number(part)] ?? null;
    if (!node) return null;
  }
  return node;
}

export function snapshotScroll(elements: Iterable<Element>, root: Element): ScrollEntry[] {
  const entries: ScrollEntry[] = [];
  for (const el of elements) {
    if (!el.isConnected || !root.contains(el)) continue;
    const key = scrollKeyFor(el, root);
    if (key) entries.push({ key, top: el.scrollTop, left: el.scrollLeft });
  }
  return entries.filter((e) => e.top > 0 || e.left > 0);
}

/**
 * Re-apply saved offsets. Views often fetch client-side after mount, so retry each frame until
 * the container exists and is tall enough, giving up after `timeoutMs` or as soon as the user
 * scrolls/types themselves. Returns a cancel function.
 */
export function restoreScroll(
  root: Element,
  entries: ScrollEntry[],
  { timeoutMs = 2500, onDone }: { timeoutMs?: number; onDone?: () => void } = {}
): () => void {
  let remaining = entries.slice();
  let frame = 0;
  let finished = false;
  const deadline = performance.now() + timeoutMs;

  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    for (const evt of USER_INPUT_EVENTS) window.removeEventListener(evt, finish, true);
    onDone?.();
  };

  const tick = () => {
    remaining = remaining.filter((entry) => {
      const el = findScrollElement(root, entry.key);
      if (!el) return true;
      el.scrollTop = entry.top;
      el.scrollLeft = entry.left;
      // Content not big enough yet (still loading) — keep trying.
      return Math.abs(el.scrollTop - entry.top) > 1 || Math.abs(el.scrollLeft - entry.left) > 1;
    });
    if (remaining.length && performance.now() < deadline) frame = requestAnimationFrame(tick);
    else finish();
  };

  for (const evt of USER_INPUT_EVENTS) window.addEventListener(evt, finish, true);
  frame = requestAnimationFrame(tick);
  return finish;
}

const USER_INPUT_EVENTS = ["wheel", "touchstart", "keydown", "mousedown"] as const;
