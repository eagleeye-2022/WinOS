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

// Pastel color palette matching Note History cards
const COLOR_PALETTE = [
  "#fef9c3", // Yellow
  "#dcfce7", // Green
  "#dbeafe", // Blue
  "#fce7f3", // Pink
  "#f3e8ff", // Purple
  "#ffedd5", // Orange
];

function getCardColor(color: string | null | undefined, id: string) {
  if (color && color !== "#ffffff" && color !== "transparent") {
    return color;
  }
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[index];
}

// ── Shared Note Card ──────────────────────────────────────────────────────────

function parseNoteContent(content: string, dbChecklistItems: { id: string; text: string; checked: boolean }[]) {
  if (dbChecklistItems && dbChecklistItems.length > 0) {
    return {
      checklist: dbChecklistItems,
      cleanText: "",
    };
  }

  if (!content) return { checklist: [], cleanText: "" };

  const extractedChecklist: { id: string; text: string; checked: boolean }[] = [];

  // Parse Tiptap TaskItems or list items from HTML
  const taskRegex = /<li[^>]*data-type="taskItem"[^>]*data-checked="(true|false)"[^>]*>(.*?)<\/li>/gi;
  let match;
  let idx = 0;

  while ((match = taskRegex.exec(content)) !== null) {
    const isChecked = match[1] === "true";
    const itemText = match[2]
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

  // Fallback: If no data-type="taskItem" found, try any <li> item
  if (extractedChecklist.length === 0) {
    const liRegex = /<li[^>]*>(.*?)<\/li>/gi;
    while ((match = liRegex.exec(content)) !== null) {
      const isChecked = match[0].includes('data-checked="true"') || match[0].includes('checked');
      const itemText = match[1]
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();

      if (itemText) {
        extractedChecklist.push({
          id: `extracted-li-${idx++}`,
          text: itemText,
          checked: isChecked,
        });
      }
    }
  }

  // Clean text preview by stripping HTML tags and un-escaping entities
  let cleanText = content
    .replace(/<li[^>]*>(.*?)<\/li>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

  if (cleanText.length > 120) {
    cleanText = cleanText.substring(0, 120) + "…";
  }

  return {
    checklist: extractedChecklist,
    cleanText: extractedChecklist.length > 0 && cleanText.length < 5 ? "" : cleanText,
  };
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
  const uncheckedItems = checklist.filter((i) => !i.checked);
  const checkedItems = checklist.filter((i) => i.checked);

  // Top unchecked items displayed as preview under title
  const topUncheckedItems = hasChecklist ? uncheckedItems.slice(0, 1) : [];
  const topUncheckedIds = new Set(topUncheckedItems.map((i) => i.id));

  // Items shown in the lower list section (remaining unchecked items + checked items)
  const remainingItems = hasChecklist
    ? [...uncheckedItems.filter((i) => !topUncheckedIds.has(i.id)), ...checkedItems]
    : [];

  const shownLowerItems = remainingItems.slice(0, 5);
  const totalMoreItems = checklist.length - (topUncheckedItems.length + shownLowerItems.length);

  const showCleanText = cleanText && cleanText.toLowerCase() !== note.title?.toLowerCase();

  return (
    <div className="flex flex-col flex-1 justify-between gap-2.5 text-left text-black">
      <div className="flex flex-col gap-2.5">
        {/* Title */}
        {note.title && (
          <h4 className="text-base font-bold text-black dark:text-black line-clamp-2">
            {note.title.length > 60 ? note.title.substring(0, 60) + "…" : note.title}
          </h4>
        )}

        {/* Content Preview (Top Unchecked Task & Clean Text Preview) */}
        {hasChecklist ? (
          <div className="flex flex-col gap-1.5">
            {showCleanText && (
              <p className="text-sm font-semibold text-black dark:text-black line-clamp-2">
                {cleanText}
              </p>
            )}
            {topUncheckedItems.map((item) => (
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
                    : "hover:bg-black/5 cursor-pointer"
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  <Square size={15} className="text-slate-700" />
                </span>
                <span className="text-sm leading-snug select-none line-clamp-2 text-black dark:text-black font-semibold">
                  {item.text.length > 80 ? item.text.substring(0, 80) + "…" : item.text}
                </span>
              </button>
            ))}
          </div>
        ) : (
          note.content && (
            <div
              className="text-sm text-black dark:text-black leading-relaxed font-medium line-clamp-3 [&_img]:max-h-36 [&_img]:w-auto [&_img]:rounded-md [&_img]:my-1"
              dangerouslySetInnerHTML={{ __html: note.content }}
            />
          )
        )}

        {/* Lower Checklist Section (Checked items & remaining list) */}
        {remainingItems.length > 0 && (
          <div className="flex flex-col gap-2 mt-1 border-t pt-2.5 border-black/10">
            {shownLowerItems.map((item) => (
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
                    : "hover:bg-black/5 cursor-pointer"
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  {item.checked ? (
                    <CheckSquare size={15} className="text-primary" />
                  ) : (
                    <Square size={15} className="text-slate-700" />
                  )}
                </span>
                <span
                  className={`text-sm leading-snug select-none line-clamp-1 ${
                    item.checked ? "text-black/50 line-through" : "text-black dark:text-black font-medium"
                  }`}
                >
                  {item.text.length > 60 ? item.text.substring(0, 60) + "…" : item.text}
                </span>
              </button>
            ))}
            {totalMoreItems > 0 && (
              <span className="text-xs text-black/60 font-medium pl-1">
                +{totalMoreItems} more items
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer Info (Date anchored at the very end of the card) */}
      <div className="flex items-center justify-between mt-auto text-xs text-black/80 dark:text-black/80 border-t pt-2 border-black/10 font-medium">
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
        <span className="text-lg font-bold text-black dark:text-black">Workspace Notes</span>
        {sharedNotes.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">
            {sharedNotes.length}
          </span>
        )}
      </div>

      {/* Shared items list */}
      <div className="px-4 py-4 flex flex-col gap-3.5">
        {sharedNotes.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-base text-black my-auto">
            <Share2 size={36} className="text-black/40 mb-3" />
            <p className="font-semibold text-black dark:text-black text-lg">No Shared Notes</p>
            <p className="text-sm text-black/70 dark:text-black/70 mt-1 max-w-xs">
              When Team Members Share Notes with You, They Will Appear Here.
            </p>
          </div>
        ) : (
          /* Shared Notes Section */
          <div className="flex flex-col gap-3.5">
            {sharedNotes.map((note) => {
              const bg = getCardColor(note.color, note.id);
              const threadTitleSub = note.threadTitle
                ? note.threadTitle.length > 25
                  ? note.threadTitle.substring(0, 25) + "…"
                  : note.threadTitle
                : "";

              return (
                <div
                  key={note.id}
                  onClick={() => setEditingNote(note)}
                  className="rounded-xl border p-3.5 flex flex-col gap-3 shadow-xs border-l-4 transition-all duration-200 hover:shadow-md cursor-pointer"
                  style={{
                    backgroundColor: bg,
                    borderLeftColor: "rgba(0, 0, 0, 0.25)",
                  }}
                >
                  <div className="flex items-center justify-between border-b pb-2 border-black/10">
                    <span className="text-xs font-bold text-black dark:text-black flex items-center gap-1 truncate max-w-[50%]" title={note.threadTitle}>
                      <Sparkles size={13} className="text-primary shrink-0" /> In {threadTitleSub}
                    </span>
                    <div className="flex items-center gap-2 text-xs font-semibold text-black/90 dark:text-black/90 shrink-0">
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
