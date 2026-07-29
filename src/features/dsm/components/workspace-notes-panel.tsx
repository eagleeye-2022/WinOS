"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Share2,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";
import { toggleBoardNoteItem } from "@/features/notes/actions/toggle-board-note-item";
import type { SharedNoteData } from "../queries";

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
    if (isReadOnly) return;
    const formData = new FormData();
    formData.append("itemId", itemId);
    startTransition(async () => {
      await toggleBoardNoteItem({}, formData);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2.5 text-left text-black">
      {/* Title */}
      {note.title && (
        <h4 className="text-base font-bold text-black dark:text-black">
          {note.title}
        </h4>
      )}

      {/* Content */}
      {note.content && (
        <div
          className="text-base text-black dark:text-black leading-relaxed html-content font-medium [&_*]:text-black"
          dangerouslySetInnerHTML={{ __html: note.content }}
        />
      )}

      {/* Checklist items */}
      {note.checklistItems.length > 0 && (
        <div className="flex flex-col gap-2 mt-1 border-t pt-2.5 border-black/10">
          {note.checklistItems.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={isPending || isReadOnly}
              onClick={() => handleToggle(item.id)}
              className={`flex items-start gap-2.5 rounded p-1 w-full text-left transition-colors ${
                isReadOnly ? "cursor-default opacity-85" : "hover:bg-black/5 cursor-pointer"
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
                className={`text-sm leading-snug select-none ${
                  item.checked ? "text-black/50 line-through" : "text-black dark:text-black font-medium"
                }`}
              >
                {item.text}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Footer Info */}
      <div className="flex items-center justify-between mt-1 text-xs text-black/80 dark:text-black/80 border-t pt-2 border-black/10 font-medium">
        <span>{new Date(note.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

type WorkspaceNotesPanelProps = {
  sharedNotes?: SharedNoteData[];
  userRole?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  note?: any;
  canEdit?: boolean;
};

export function WorkspaceNotesPanel({
  sharedNotes = [],
  userRole,
}: WorkspaceNotesPanelProps) {
  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <span className="text-lg font-bold text-black dark:text-black">Workspace Notes</span>
        {sharedNotes.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">
            {sharedNotes.length}
          </span>
        )}
      </div>

      {/* Scrollable shared items list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3.5">
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
              return (
                <div
                  key={note.id}
                  className="rounded-xl border p-3.5 flex flex-col gap-3 shadow-xs border-l-4 transition-all duration-200 hover:shadow-md"
                  style={{
                    backgroundColor: bg,
                    borderLeftColor: "rgba(0, 0, 0, 0.25)",
                  }}
                >
                  <div className="flex items-center justify-between border-b pb-2 border-black/10">
                    <span className="text-xs font-bold text-black dark:text-black flex items-center gap-1">
                      <Sparkles size={13} className="text-primary" /> In {note.threadTitle}
                    </span>
                    <span className="text-xs font-semibold text-black/90 dark:text-black/90">
                      by {note.authorName} {note.authorRole === "MANAGER" && "(Manager)"}
                    </span>
                  </div>
                  <SharedNoteCard note={note} userRole={userRole} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
