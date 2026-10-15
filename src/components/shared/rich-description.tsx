"use client";

import dynamic from "next/dynamic";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Link } from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Highlight } from "@tiptap/extension-highlight";

/** The shared TipTap editor (same as Notes), loaded on demand since it's only used while editing. */
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
  loading: () => <div className="h-[200px] animate-pulse rounded-md border bg-muted/40" />,
});

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const URL_RE = /(https?:\/\/[^\s<]+)/g;

/** One plain-text line as HTML, with bare URLs as links (trailing sentence punctuation left out). */
function linkifyLine(line: string): string {
  return line
    .split(URL_RE)
    .map((part, i) => {
      if (i % 2 === 0) return escapeHtml(part);
      const trailing = part.match(/[.,;:!?)]+$/)?.[0] ?? "";
      const url = trailing ? part.slice(0, -trailing.length) : part;
      return `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>${escapeHtml(trailing)}`;
    })
    .join("");
}

/**
 * Descriptions are HTML from the rich editor, or plain text (older tasks, Zoho imports). Plain
 * text becomes one paragraph per line, with bare URLs as links, so it reads as before.
 */
export function toDescriptionHtml(value: string): string {
  const v = (value || "").trim();
  if (!v) return "";
  if (/<[a-z][\s\S]*>/i.test(v)) return v;
  return v
    .split(/\r?\n/)
    .map((line) => `<p>${linkifyLine(line)}</p>`)
    .join("");
}

/** True when a value has no visible text or image (e.g. an emptied editor's "<p></p>"). */
export function isEmptyDescription(value: string | null | undefined): boolean {
  const v = value || "";
  if (/<img\b/i.test(v)) return false;
  return v.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "";
}

/** Rich-text editor for a task description. */
export function RichDescriptionEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  return (
    <div className="overflow-hidden rounded-md border border-input bg-background text-foreground">
      <RichTextEditor value={toDescriptionHtml(value)} onChange={onChange} />
    </div>
  );
}

/**
 * Read-only render of a description. Goes through TipTap's schema (not raw innerHTML), so only
 * the formatting the editor supports is kept — scripts and unknown markup are dropped.
 */
export function RichDescriptionView({ value, className }: { value: string; className?: string }) {
  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: false,
      content: toDescriptionHtml(value),
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Underline,
        Link.configure({
          openOnClick: true,
          HTMLAttributes: {
            class: "text-info underline hover:text-info/80 dark:text-sky-400 break-all",
            target: "_blank",
            rel: "noopener noreferrer",
          },
        }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Highlight,
        Image.configure({ inline: true, allowBase64: true, HTMLAttributes: { class: "max-w-full h-auto rounded-md my-1" } }),
      ],
      editorProps: {
        attributes: {
          class:
            className ??
            "prose prose-sm max-w-none text-xs leading-relaxed text-foreground/90 prose-p:my-1 break-words dark:prose-invert",
        },
      },
    },
    [value]
  );

  return <EditorContent editor={editor} />;
}
