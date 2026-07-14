"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Share2,
  Calendar,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";
import { toggleBoardNoteItem } from "@/features/notes/actions/toggle-board-note-item";
import type { SharedNoteData } from "../queries";

// ── Shared Note Card ──────────────────────────────────────────────────────────

function SharedNoteCard({
  note,
  userRole,
}: {
  note: {
    id: string;
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
    <div
      className="rounded-lg border p-3 flex flex-col gap-2 relative shadow-2xs text-left"
      style={{
        backgroundColor: note.color ? `${note.color}d9` : "rgba(255, 255, 255, 0.75)",
        backdropFilter: "blur(2px)",
      }}
    >
      {/* Content */}
      {note.content && (
        <div
          className="text-xs text-foreground leading-relaxed html-content"
          dangerouslySetInnerHTML={{ __html: note.content }}
        />
      )}

      {/* Checklist items */}
      {note.checklistItems.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1 border-t pt-2 border-black/5">
          {note.checklistItems.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={isPending || isReadOnly}
              onClick={() => handleToggle(item.id)}
              className={`flex items-start gap-2 rounded p-0.5 w-full text-left transition-colors ${
                isReadOnly ? "cursor-default opacity-85" : "hover:bg-black/5 cursor-pointer"
              }`}
            >
              <span className="mt-0.5 shrink-0">
                {item.checked ? (
                  <CheckSquare size={12} className="text-primary" />
                ) : (
                  <Square size={12} className="text-muted-foreground/60" />
                )}
              </span>
              <span
                className={`text-[10px] leading-tight select-none ${
                  item.checked ? "text-muted-foreground line-through" : "text-foreground font-medium"
                }`}
              >
                {item.text}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Footer Info */}
      <div className="flex items-center justify-between mt-1 text-[8px] text-muted-foreground/80 border-t pt-1.5 border-black/5">
        <span>{new Date(note.createdAt).toLocaleDateString()}</span>
        {note.deadline && (
          <span className="flex items-center gap-0.5 text-amber-700 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded-full">
            <Calendar size={8} />
            Due {new Date(note.deadline).toLocaleDateString()}
          </span>
        )}
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
        <span className="text-base font-bold text-foreground">Workspace Notes</span>
        {sharedNotes.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
            {sharedNotes.length}
          </span>
        )}
      </div>

      {/* Scrollable shared items list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {sharedNotes.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground my-auto">
            <Share2 size={32} className="text-muted-foreground/40 mb-3" />
            <p className="font-medium text-foreground">No shared notes</p>
            <p className="text-xs text-muted-foreground/75 mt-1 max-w-xs">
              When team members share notes with you, they will appear here.
            </p>
          </div>
        ) : (
          /* Shared Notes Section */
          <div className="flex flex-col gap-3">
            {sharedNotes.map((note) => (
              <div
                key={note.id}
                className="border border-border/80 bg-accent/5 rounded-xl p-3 flex flex-col gap-2.5 shadow-xs"
              >
                <div className="flex items-center justify-between border-b pb-1.5 border-border/30">
                  <span className="text-[10px] font-semibold text-primary flex items-center gap-1">
                    <Sparkles size={10} /> In {note.threadTitle}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    by {note.authorName} {note.authorRole === "MANAGER" && "(Manager)"}
                  </span>
                </div>
                <SharedNoteCard note={note} userRole={userRole} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
