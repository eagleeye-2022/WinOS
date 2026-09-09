"use client";

import React, { useEffect, useRef } from "react";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Splits on bare URLs and escapes everything so it's safe to drop straight into innerHTML —
 *  the URL segments (odd indices) become anchors, everything else stays plain escaped text. */
function buildHighlightedHtml(text: string): string {
  const parts = text.split(URL_PATTERN);
  return parts
    .map((part, i) =>
      i % 2 === 1
        ? `<a href="${escapeHtml(part)}" class="linkify-url" contenteditable="false">${escapeHtml(part)}</a>`
        : escapeHtml(part)
    )
    .join("");
}

/** Character offset of the caret relative to `root`'s full text content. */
function getCaretOffset(root: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return 0;
  const preRange = range.cloneRange();
  preRange.selectNodeContents(root);
  preRange.setEnd(range.endContainer, range.endOffset);
  return preRange.toString().length;
}

/** Restores the caret to a character offset within `root`'s full text content. */
function setCaretOffset(root: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node = walker.nextNode() as Text | null;
  let lastNode: Text | null = null;
  while (node) {
    lastNode = node;
    const len = node.textContent?.length ?? 0;
    if (remaining <= len) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    remaining -= len;
    node = walker.nextNode() as Text | null;
  }
  // Offset ran past all text (e.g. caret at the very end) — park it after the last node.
  const range = document.createRange();
  if (lastNode) {
    range.setStart(lastNode, lastNode.textContent?.length ?? 0);
  } else {
    range.selectNodeContents(root);
  }
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

interface LinkifyEditableTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  rows?: number;
}

/** A plain-text editable box that behaves like a <textarea> (same string value in/out) but
 *  highlights bare URLs as blue, clickable links live while typing/pasting — a <textarea>
 *  can't render partial styling since it's a native form control with no rich content. */
export function LinkifyEditableTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  autoFocus,
  rows = 4,
}: LinkifyEditableTextareaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);

  // Keep the DOM in sync when `value` changes from outside (initial mount, Cancel reset, etc.)
  // without clobbering the user's caret position on every keystroke-driven update.
  const lastRenderedValueRef = useRef<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || value === lastRenderedValueRef.current) return;
    el.innerHTML = buildHighlightedHtml(value);
    lastRenderedValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const handleInput = () => {
    const el = ref.current;
    if (!el || isComposingRef.current) return;
    const text = el.textContent || "";
    const caret = getCaretOffset(el);
    el.innerHTML = buildHighlightedHtml(text);
    lastRenderedValueRef.current = text;
    setCaretOffset(el, caret);
    onChange(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.execCommand("insertText", false, "\n");
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (anchor instanceof HTMLAnchorElement) {
      e.preventDefault();
      window.open(anchor.href, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-placeholder={placeholder}
      data-placeholder={placeholder}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onClick={handleClick}
      onCompositionStart={() => {
        isComposingRef.current = true;
      }}
      onCompositionEnd={() => {
        isComposingRef.current = false;
        handleInput();
      }}
      style={{ minHeight: `${rows * 1.4}em` }}
      className={`linkify-editable whitespace-pre-wrap break-words font-sans ${className}`}
    />
  );
}
