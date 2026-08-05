"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import dynamic from "next/dynamic";
import { cn, toTitleCase } from "@/lib/utils";
import { updateBoardNote } from "../actions/update-board-note";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

const PASTEL_COLORS = [
  "#ffffff", // White
  "#fffbeb", // Soft Amber
  "#f0fdf4", // Soft Emerald
  "#eff6ff", // Soft Blue
  "#faf5ff", // Soft Purple
];

export type EditNoteModalData = {
  id: string;
  title?: string | null;
  content: string;
  color: string | null;
  deadline: Date | null;
  checklistItems: { text: string }[];
};

export interface EditNoteModalProps<T extends EditNoteModalData> {
  note: T;
  onNoteChange: (note: T) => void;
  canEdit: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
}

export function EditNoteModal<T extends EditNoteModalData>({
  note,
  onNoteChange,
  canEdit,
  onClose,
  onSaved,
}: EditNoteModalProps<T>) {
  const [isPending, startTransition] = useTransition();
  const isReadOnly = !canEdit;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    const formData = new FormData();
    formData.append("id", note.id);
    if (note.title !== undefined) formData.append("title", note.title || "");
    formData.append("color", note.color || "#ffffff");
    if (note.deadline) {
      formData.append("deadline", new Date(note.deadline).toISOString().slice(0, 16));
    }
    formData.append("content", note.content || "");
    note.checklistItems.forEach((item) => {
      if (item.text.trim()) formData.append("item", item.text);
    });

    startTransition(async () => {
      const res = await updateBoardNote({}, formData);
      if (res.message === "updated") {
        onClose();
        await onSaved?.();
      } else {
        alert(res.message || "Failed to save note.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-5xl max-h-[100vh] rounded-xl bg-card border p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-100"
      >
        <div className="flex items-center justify-between border-b pb-3 shrink-0">
          <span className="text-sm font-bold text-foreground">
            {isReadOnly ? "View Note Card" : "Edit Note Card"}
          </span>
          {/* <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button> */}
        </div>

        <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto max-h-[82vh] pr-1">
          <div
            className="border rounded-lg p-4 flex flex-col gap-2.5"
            style={{ backgroundColor: note.color || "#ffffff" }}
          >
            {/* Card Title */}
            {isReadOnly ? (
              note.title && (
                <h3 className="text-base font-bold text-foreground mb-1.5">{toTitleCase(note.title)}</h3>
              )
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Card Title
                </label>
                <input
                  type="text"
                  value={note.title || ""}
                  onChange={(e) => onNoteChange({ ...note, title: e.target.value })}
                  placeholder="Enter card title..."
                  className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
                  maxLength={120}
                />
              </div>
            )}

            {/* Text Content */}
            {isReadOnly ? (
              <div
                className="text-sm text-foreground bg-background rounded-lg border p-3.5 leading-relaxed html-content text-left"
                dangerouslySetInnerHTML={{ __html: note.content || "" }}
              />
            ) : (
              <div className="bg-background text-foreground rounded border text-sm max-w-full overflow-hidden">
                <RichTextEditor
                  value={note.content || ""}
                  onChange={(val) => onNoteChange({ ...note, content: val })}
                />
              </div>
            )}

            {/* Color Picker */}
            <div className="flex flex-col gap-1 mt-2 border-t pt-2 border-black/5">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                Card Color
              </label>
              <div className="flex items-center gap-1.5 mt-1">
                {PASTEL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => onNoteChange({ ...note, color: c })}
                    className={cn(
                      "h-5.5 w-5.5 rounded-full border border-black/10 shadow-xs relative transition-transform hover:scale-110",
                      note.color === c && "ring-1 ring-primary scale-110"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-3 mt-2 shrink-0">
          {isReadOnly ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-primary text-primary-foreground px-5 py-2 text-xs font-semibold shadow hover:opacity-90"
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border px-4 py-2 text-xs hover:bg-accent font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-primary text-primary-foreground px-5 py-2 text-xs font-semibold shadow hover:opacity-90 disabled:opacity-50"
              >
                Save Edits
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
