"use client";

import { useEffect } from "react";
import { toTitleCaseText } from "@/lib/title-case";

/**
 * App-wide title case (see `toTitleCaseText`): mounted once in the root layout.
 *
 *  - Visible text: every text node (and input placeholder) is re-cased as pages render/update.
 *  - Inputs: the value is re-cased as the user types, *before* React's onChange reads it, so the
 *    saved value is title case too. Only letter case changes, so the caret is restored exactly.
 *
 * Skipped (left exactly as written): rich-text editors, textareas and pre-wrapped long text
 * (comments, notes), code blocks, external/mailto links, password/email/url/number/OTP/CAPTCHA
 * fields, SVG, and anything inside `.keep-case` / `[data-keep-case]`.
 */

const SKIP_TEXT_ANCESTOR = [
  "script", "style", "noscript", "svg", "textarea", "code", "pre", "kbd",
  "[contenteditable]", ".tiptap", ".ProseMirror",
  ".whitespace-pre-wrap", ".whitespace-pre-line",
  "a[href^='http']", "a[href^='mailto:']",
  ".keep-case", "[data-keep-case]",
].join(",");

const SKIP_INPUT = [
  "[data-keep-case]", ".keep-case", "[name='otp']", "[name^='captcha']",
  "[inputmode='numeric']", "[inputmode='email']", "[inputmode='url']",
  "[autocomplete='one-time-code']", "[autocomplete='email']", "[autocomplete='username']",
  "[readonly]",
].join(",");

const TEXT_INPUT_TYPES = new Set(["", "text", "search"]);

function isCasedInput(el: EventTarget | null): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement)) return false;
  if (!TEXT_INPUT_TYPES.has((el.getAttribute("type") || "").toLowerCase())) return false;
  return !el.matches(SKIP_INPUT) && !el.closest(".keep-case, [data-keep-case]");
}

function skipText(node: Node): boolean {
  const parent = node.parentElement;
  return !parent || !!parent.closest(SKIP_TEXT_ANCESTOR);
}

/** Text rendered just before this node in the same element (React splits `Task{s}` into nodes). */
function textBefore(node: Text): string {
  return node.previousSibling?.textContent ?? "";
}

/** Whether a text node continues a sentence from earlier text (so a leading "of" stays lowercase). */
function continuesSentence(before: string): boolean {
  return before.trim() !== "" && !/[.!?:]["')\]]*\s*$/.test(before);
}

function caseTextNode(node: Text) {
  const value = node.nodeValue;
  if (!value || !/[a-z]/i.test(value) || skipText(node)) return;
  const before = textBefore(node);
  // "Task" + "s" → the "s" finishes the word "Tasks", it isn't a new word.
  const continuesWord = /[A-Za-z']$/.test(before);
  const next = toTitleCaseText(value, !continuesSentence(before), continuesWord);
  if (next !== value) node.nodeValue = next;
}

function casePlaceholder(el: Element) {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  if (el instanceof HTMLInputElement && !isCasedInput(el)) return;
  const ph = el.getAttribute("placeholder");
  if (!ph) return;
  const next = toTitleCaseText(ph);
  if (next !== ph) el.setAttribute("placeholder", next);
}

function caseSubtree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    caseTextNode(root as Text);
    return;
  }
  if (!(root instanceof Element) || root.closest(SKIP_TEXT_ANCESTOR)) return;
  casePlaceholder(root);
  root.querySelectorAll("input[placeholder], textarea[placeholder]").forEach(casePlaceholder);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) caseTextNode(n as Text);
}

// Native setter, so React's value tracker sees the change made before its own listener runs.
const inputValueSetter =
  typeof window !== "undefined"
    ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    : undefined;

export function TitleCaseEnforcer() {
  useEffect(() => {
    // Inputs: re-case on every keystroke, in the capture phase on `document` — that runs before
    // React's root listener, so onChange already receives the title-cased value.
    const onInput = (e: Event) => {
      if ((e as InputEvent).isComposing) return;
      const el = e.target;
      if (!isCasedInput(el)) return;
      const value = el.value;
      const next = toTitleCaseText(value);
      if (next === value) return;
      const { selectionStart, selectionEnd, selectionDirection } = el;
      if (inputValueSetter) inputValueSetter.call(el, next);
      else el.value = next;
      if (selectionStart !== null && selectionEnd !== null) {
        el.setSelectionRange(selectionStart, selectionEnd, selectionDirection ?? undefined);
      }
    };
    document.addEventListener("input", onInput, true);

    // Visible text: one full pass once the page has settled (after hydration), then only what
    // changes. Re-casing is idempotent, so our own writes don't loop.
    let observer: MutationObserver | null = null;
    const start = () => {
      caseSubtree(document.body);
      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "characterData") caseTextNode(m.target as Text);
          else if (m.type === "attributes") casePlaceholder(m.target as Element);
          else m.addedNodes.forEach(caseSubtree);
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["placeholder"],
      });
    };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback;
    const handle = ric ? ric(start, { timeout: 500 }) : window.setTimeout(start, 200);

    return () => {
      document.removeEventListener("input", onInput, true);
      observer?.disconnect();
      const cic = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (ric && cic) cic(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  return null;
}
