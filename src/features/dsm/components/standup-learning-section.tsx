"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, GraduationCap, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { updateLearningText, type UpdateLearningState } from "@/features/dsm/manager/actions/update-learning";

export function StandupLearningSection({
  entryId,
  learningText,
  isReviewed = false,
}: {
  entryId: string;
  learningText: string | null;
  isReviewed?: boolean;
}) {
  const [, action, pending] = useActionState<UpdateLearningState, FormData>(updateLearningText, {});
  const [, startTransition] = useTransition();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [editText, setEditText] = useState("");

  const lines = learningText
    ? learningText.split("\n").map((l) => l.trim()).filter(Boolean)
    : [];

  const handleSaveAll = (newLines: string[]) => {
    const fd = new FormData();
    fd.set("entryId", entryId);
    fd.set("learningText", newLines.join("\n"));
    startTransition(() => {
      action(fd);
    });
  };

  const handleEdit = (index: number) => {
    if (!editText.trim()) return;
    const updated = [...lines];
    updated[index] = editText.trim();
    handleSaveAll(updated);
    setEditingIndex(null);
    setEditText("");
  };

  const handleDelete = (index: number) => {
    const updated = lines.filter((_, i) => i !== index);
    handleSaveAll(updated);
  };

  const handleAdd = () => {
    if (!newText.trim()) return;
    const updated = [...lines, newText.trim()];
    handleSaveAll(updated);
    setNewText("");
    setAdding(false);
  };

  // If not reviewed and has no lines, don't show empty box
  if (!isReviewed && lines.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-md border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <GraduationCap size={14} className="text-primary" />
          What Will You Learn Today( Whyfi School )?
          <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary normal-case tracking-normal">
            {lines.length}
          </span>
        </p>
      </div>

      <div className="space-y-1.5">
        {lines.map((line, i) => {
          if (isReviewed && editingIndex === i) {
            return (
              <div key={i} className="flex items-center gap-2 rounded-lg border bg-background p-1.5">
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleEdit(i);
                    }
                  }}
                  className="flex-1 rounded border px-2 py-1 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => handleEdit(i)}
                  disabled={pending}
                  className="rounded-md bg-success/10 p-1.5 text-success hover:bg-success/20 transition-colors"
                >
                  <Check size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingIndex(null)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            );
          }

          return (
            <div
              key={i}
              className="group/item flex items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start gap-2 text-xs leading-relaxed text-foreground/90 flex-1 min-w-0">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                <span>{line}</span>
              </div>

              {isReviewed && (
                <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingIndex(i);
                      setEditText(line);
                    }}
                    title="Edit learning item"
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(i)}
                    title="Delete learning item"
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {lines.length === 0 && isReviewed && (
          <p className="text-xs text-muted-foreground italic py-1">
            No learning items logged for today.
          </p>
        )}
      </div>

      {isReviewed && (
        <div className="mt-2.5">
          {adding ? (
            <div className="flex items-center gap-2 rounded-lg border bg-background p-1.5">
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                autoFocus
                placeholder="Describe what will be learned (Whyfi School)..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                className="flex-1 rounded border px-2.5 py-1 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={pending || !newText.trim()}
                className="rounded-md bg-success/10 p-1.5 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
              >
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewText("");
                }}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-dashed py-1.5 text-xs font-medium text-primary/70 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary dark:text-[#3B82F6] dark:hover:text-[#2563EB] dark:border-[#3B82F6]/40"
            >
              <Plus size={13} className="dark:text-[#93C5FD]" /> Add Learning Task
            </button>
          )}
        </div>
      )}
    </div>
  );
}
