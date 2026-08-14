"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Share2,
  CheckSquare,
  Square,
  Sparkles,
  Pencil,
} from "lucide-react";
import { toggleBoardNoteItem } from "@/features/notes/actions/toggle-board-note-item";
import { EditNoteModal } from "@/features/notes/components/edit-note-modal";
import type { SharedNoteData } from "../queries";
import { toTitleCase } from "@/lib/utils";

// Pastel color palette matching Note History cards for Light mode, and rich dark tones for Dark mode
const COLOR_PALETTE = [
  { light: "#fef9c3", dark: "#1e1b13", border: "#eab308" }, // Yellow
  { light: "#dcfce7", dark: "#12251a", border: "#22c55e" }, // Green
  { light: "#dbeafe", dark: "#132238", border: "#3b82f6" }, // Blue
  { light: "#fce7f3", dark: "#281523", border: "#ec4899" }, // Pink
  { light: "#f3e8ff", dark: "#21152d", border: "#a855f7" }, // Purple
  { light: "#ffedd5", dark: "#2a1b12", border: "#f97316" }, // Orange
];

function getCardColors(color: string | null | undefined, id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTE.length;
  const palette = COLOR_PALETTE[index];

  if (color && color !== "#ffffff" && color !== "transparent") {
    return {
      light: color,
      dark: "#1e2430",
      border: color,
    };
  }

  return palette;
}

// ── Shared Note Card ──────────────────────────────────────────────────────────

function extractFirstContentHeading(content: string): string {
  if (!content || !content.trim()) return "";

  // 1. HTML Headings (h1-h6)
  const hMatch = content.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (hMatch && hMatch[1]) {
    const text = hMatch[1].replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    if (text) return text;
  }

  // 2. Strong / Bold tags (<p><strong>...</strong></p> or <strong>...</strong>)
  const strongMatch = content.match(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/i);
  if (strongMatch && strongMatch[1]) {
    const text = strongMatch[1].replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    if (text) return text;
  }

  // 3. Markdown headings (# Heading) or bold (**Heading**)
  const mdMatch = content.match(/^(?:\s*#+\s*|\s*\*\*|\s*__)(.*?)(?:\*\*|__|[\r\n]|$)/m);
  if (mdMatch && mdMatch[1]) {
    const text = mdMatch[1].replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    if (text) return text;
  }

  // 4. First non-empty line of text
  const cleanHtml = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  const lines = cleanHtml.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    let firstLine = lines[0];
    const boldBlock = firstLine.match(/^\*\*([^*]+)\*\*/);
    if (boldBlock) {
      firstLine = boldBlock[1].trim();
    }
    if (firstLine.length > 20) {
      firstLine = firstLine.substring(0, 20) + "...";
    }
    return firstLine;
  }

  return "";
}

function parseNoteContent(content: string, dbChecklistItems: { id: string; text: string; checked: boolean }[]) {
  const extractedChecklist: { id: string; text: string; checked: boolean }[] = [];

  if (dbChecklistItems && dbChecklistItems.length > 0) {
    extractedChecklist.push(...dbChecklistItems);
  } else if (content) {
    // Parse Tiptap TaskItems or list items from HTML
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let match;
    let idx = 0;

    while ((match = liRegex.exec(content)) !== null) {
      const liHtml = match[0];
      const innerHtml = match[1];

      const isTaskItem = liHtml.includes('data-type="taskItem"') || innerHtml.includes('type="checkbox"');
      if (!isTaskItem) continue;

      let isChecked = false;
      if (/data-checked=["']true["']/i.test(liHtml)) {
        isChecked = true;
      } else if (/data-checked=["']false["']/i.test(liHtml)) {
        isChecked = false;
      } else if (/<input[^>]*type=["']checkbox["'][^>]*checked/i.test(innerHtml) || /<input[^>]*checked[^>]*type=["']checkbox["']/i.test(innerHtml)) {
        isChecked = true;
      }

      const itemText = innerHtml
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();

      if (itemText) {
        extractedChecklist.push({
          id: `extracted-task-${idx++}`,
          text: itemText,
          checked: isChecked,
        });
      }
    }
  }

  const cleanText = extractFirstContentHeading(content);

  return {
    checklist: extractedChecklist,
    cleanText,
  };
}

function extractFirstHeading(title?: string | null, content?: string | null): string {
  const cleanHeading = (raw: string): string => {
    let s = raw
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/^[\s#*_-]+/, "")
      .replace(/[\s*_-]+$/, "")
      .replace(/\s+/g, " ")
      .trim();

    const boldMatch = s.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      s = boldMatch[1].trim();
    }

    if (s.includes("\n")) {
      s = s.split("\n")[0].trim();
    }

    return s;
  };

  if (title && title.trim()) {
    const htmlHeading =
      title.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i) ||
      title.match(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/i);
    if (htmlHeading && htmlHeading[1]) {
      const cleaned = cleanHeading(htmlHeading[1]);
      if (cleaned) return cleaned;
    }

    const firstLine = title.split(/[\r\n]+/)[0];
    const cleaned = cleanHeading(firstLine);
    if (cleaned) return cleaned;
  }

  if (!content || !content.trim()) return "";

  return extractFirstContentHeading(content);
}

function SharedNoteCard({
  note,
  userRole,
}: {
  note: {
    id: string;
    title?: string | null;
    content: string;
    color: string | null;
    deadline: Date | null;
    createdAt: Date;
    authorName?: string;
    authorRole?: string;
    checklistItems: { id: string; text: string; checked: boolean }[];
  };
  userRole?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isReadOnly = userRole === "TEAM_MEMBER" && note.authorRole === "MANAGER";

  const handleToggle = async (itemId: string) => {
    if (isReadOnly || itemId.startsWith("extracted-")) return;
    const formData = new FormData();
    formData.append("itemId", itemId);
    startTransition(async () => {
      await toggleBoardNoteItem({}, formData);
      router.refresh();
    });
  };

  const { checklist, cleanText } = parseNoteContent(note.content, note.checklistItems);

  const hasChecklist = checklist.length > 0;
  const shownItems = checklist.slice(0, 6);
  const totalMoreItems = checklist.length - shownItems.length;

  const rawCardTitle = extractFirstHeading(note.title, note.content);
  const cardTitle = rawCardTitle.length > 20 ? rawCardTitle.substring(0, 20) + "..." : rawCardTitle;
  const showCleanText = cleanText && cleanText.toLowerCase() !== rawCardTitle.toLowerCase();
  const formattedCleanText = cleanText.length > 20 ? cleanText.substring(0, 20) + "..." : cleanText;

  return (
    <div className="flex flex-col flex-1 justify-between gap-2.5 text-left text-slate-900 dark:text-slate-100">
      <div className="flex flex-col gap-2.5">
        {/* Title */}
        {cardTitle && (
          <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
            {cardTitle}
          </h4>
        )}

        {/* Content Preview (Clean Text Preview if available) */}
        {showCleanText && (
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
            {formattedCleanText}
          </p>
        )}

        {/* Checklist items section displaying exact persisted order and checkbox states */}
        {hasChecklist ? (
          <div className="flex flex-col gap-1.5 mt-1 border-t border-slate-900/10 dark:border-slate-100/10 pt-2 font-medium">
            {shownItems.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={isPending || isReadOnly || item.id.startsWith("extracted-")}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggle(item.id);
                }}
                className={`flex items-start gap-2.5 rounded p-1 w-full text-left transition-colors ${
                  isReadOnly || item.id.startsWith("extracted-")
                    ? "cursor-default opacity-90"
                    : "hover:bg-slate-900/5 dark:hover:bg-slate-100/10 cursor-pointer"
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  {item.checked ? (
                    <CheckSquare size={15} className="text-primary" />
                  ) : (
                    <Square size={15} className="text-slate-600 dark:text-slate-400" />
                  )}
                </span>
                <span
                  className={`text-sm leading-snug select-none line-clamp-2 ${
                    item.checked ? "text-slate-500 dark:text-slate-400 line-through font-normal" : "text-slate-900 dark:text-slate-100 font-semibold"
                  }`}
                >
                  {item.text.length > 80 ? item.text.substring(0, 80) + "…" : item.text}
                </span>
              </button>
            ))}
            {totalMoreItems > 0 && (
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium pl-1">
                +{totalMoreItems} more items
              </span>
            )}
          </div>
        ) : (
          note.content && (
            <div
              className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium line-clamp-3 [&_img]:max-h-36 [&_img]:w-auto [&_img]:rounded-md [&_img]:my-1"
              dangerouslySetInnerHTML={{ __html: note.content }}
            />
          )
        )}
      </div>

      {/* Footer Info (Date anchored at the very end of the card) */}
      <div className="flex items-center justify-between mt-auto text-xs text-slate-600 dark:text-slate-400 border-t pt-2 border-slate-900/10 dark:border-slate-100/10 font-medium">
        <span>
          {new Date(note.createdAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

type WorkspaceNotesPanelProps = {
  sharedNotes?: SharedNoteData[];
  userRole?: string;
};

export function WorkspaceNotesPanel({
  sharedNotes = [],
  userRole,
}: WorkspaceNotesPanelProps) {
  const router = useRouter();
  const [editingNote, setEditingNote] = useState<SharedNoteData | null>(null);

  return (
    <div className="flex flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <span className="text-lg font-bold text-foreground">Workspace Notes</span>
        {sharedNotes.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">
            {sharedNotes.length}
          </span>
        )}
      </div>

      {/* Shared items list */}
      <div className="px-4 py-4 flex flex-col gap-3.5">
        {sharedNotes.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-base text-foreground my-auto">
            <Share2 size={36} className="text-muted-foreground mb-3" />
            <p className="font-semibold text-foreground text-lg">No Shared Notes</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              When Team Members Share Notes with You, They Will Appear Here.
            </p>
          </div>
        ) : (
          /* Shared Notes Section */
          <div className="flex flex-col gap-3.5">
            {sharedNotes.map((note) => {
              const palette = getCardColors(note.color, note.id);
              const threadTitleSub = note.threadTitle
                ? note.threadTitle.length > 20
                  ? note.threadTitle.substring(0, 20) + "..."
                  : note.threadTitle
                : "";

              return (
                <div
                  key={note.id}
                  onClick={() => setEditingNote(note)}
                  className="rounded-xl border p-3.5 flex flex-col gap-3 shadow-xs border-l-4 transition-all duration-200 hover:shadow-md cursor-pointer border-slate-200/80 dark:border-slate-800/80 bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)]"
                  style={{
                    ["--card-bg-light" as string]: palette.light,
                    ["--card-bg-dark" as string]: palette.dark,
                    borderLeftColor: palette.border,
                  }}
                >
                  <div className="flex items-center justify-between border-b pb-2 border-slate-900/10 dark:border-slate-100/10">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 truncate max-w-[50%]" title={note.threadTitle}>
                      <Sparkles size={13} className="text-primary shrink-0" /> In {threadTitleSub}
                    </span>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                      {note.canEdit && (
                        <span
                          title="You can edit this note"
                          className="flex items-center gap-1 text-xs font-semibold text-primary"
                        >
                          <Pencil size={11} />
                        </span>
                      )}
                      <span>
                        By {toTitleCase(note.authorName)} {note.authorRole === "MANAGER" && "(Manager)"}
                      </span>
                    </div>
                  </div>
                  <SharedNoteCard note={note} userRole={userRole} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingNote && (
        <EditNoteModal
          note={editingNote}
          onNoteChange={setEditingNote}
          canEdit={editingNote.canEdit}
          onClose={() => setEditingNote(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
