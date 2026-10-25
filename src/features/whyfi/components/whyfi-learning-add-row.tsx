"use client";

import { useState } from "react";
import { Calendar, Loader2, Plus, X } from "lucide-react";
import { DueDateInput, TaskInfoLink, TodayDueButton } from "@/components/shared/task-table-parts";
import { projectTaskHref } from "@/lib/project-task-href";
import { useFormDraft } from "@/hooks/use-form-draft";
import type { WhyfiPickerTask } from "../actions";
import { WhyfiTaskSelectors } from "./whyfi-task-selectors";

/**
 * "+ Add Learning Task" for a DSM's WhyFi School section, laid out like the DSM "New Task" row:
 * NEW LEARNING TASK: [Task List → Task → Subtask] / description / DUE: [date] [Today]  [Add] [Cancel].
 * The due date belongs to the picked card (learning lines are plain text), so it needs a card.
 */
export function WhyfiLearningAddRow({
  tasks,
  loading,
  onAdd,
  draftKey = null,
}: {
  tasks: WhyfiPickerTask[];
  loading: boolean;
  /** Saves the line; `task` is the picked card (if any) and `dueDate` ("YYYY-MM-DD" or "") its due date. */
  onAdd: (text: string, task: WhyfiPickerTask | undefined, dueDate: string) => Promise<void> | void;
  /** localStorage key that keeps unsent input across reloads; none → not kept. */
  draftKey?: string | null;
}) {
  const [adding, setAdding] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useFormDraft(draftKey, { taskId, text, dueDate }, adding, (d) => {
    setTaskId(d.taskId ?? "");
    setText(d.text ?? "");
    setDueDate(d.dueDate ?? "");
    setAdding(true);
  });

  const task = tasks.find((t) => t.id === taskId);
  const canAdd = Boolean(text.trim() || task) && !saving;

  const reset = () => {
    setTaskId("");
    setText("");
    setDueDate("");
    setAdding(false);
  };

  const pickTask = (id: string) => {
    setTaskId(id);
    const picked = tasks.find((t) => t.id === id);
    // Start from the card's own due date, so saving doesn't clear one that's already set.
    setDueDate(picked?.dueDate || "");
  };

  const submit = async () => {
    if (!canAdd) return;
    setSaving(true);
    try {
      await onAdd(text.trim() || task?.title || "", task, dueDate);
      reset();
    } finally {
      setSaving(false);
    }
  };

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-xs font-medium text-primary/70 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
      >
        <Plus size={13} /> Add Learning Task
      </button>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-primary/40 bg-card p-3 shadow-xs">
      {/* Task List → Task → Subtask */}
      <div className="flex flex-wrap items-center gap-2.5 text-xs">
        <span className="text-xs font-semibold uppercase text-muted-foreground">New Learning Task:</span>
        <WhyfiTaskSelectors tasks={tasks} loading={loading} value={taskId} onChange={pickTask} />
      </div>

      {/* Code chip + description */}
      <div className="flex items-center gap-2">
        {task && (
          <span
            title={`${task.title} · ${task.listName}`}
            className="shrink-0 cursor-default rounded border border-primary/20 bg-primary/10 px-2 py-1 font-mono text-xs font-bold text-primary"
          >
            {task.code}
          </span>
        )}
        {task && <TaskInfoLink href={projectTaskHref(task.projectId, task.code)!} code={task.code} />}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          readOnly={saving}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            } else if (e.key === "Escape" && !saving) {
              reset();
            }
          }}
          placeholder={task ? "Optional note (defaults to the task title)..." : "Describe what will be learned..."}
          className="flex-1 rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Due date (of the picked card) + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-2">
        <div className="flex flex-wrap items-center gap-3" title={task ? undefined : "Pick a WhyFi task to set its due date"}>
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
            <Calendar size={12} className="text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider">Due:</span>
            <DueDateInput value={dueDate} onChange={setDueDate} disabled={!task || saving} />
          </div>
          <TodayDueButton value={dueDate} onChange={setDueDate} disabled={!task || saving} />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canAdd}
            title="Add learning task"
            className="flex items-center gap-1 rounded-md bg-success/10 px-2.5 py-1.5 text-xs font-semibold text-success transition-colors hover:bg-success/20 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} strokeWidth={2.5} />}
            {saving ? "Saving…" : "Add Task"}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={saving}
            title="Cancel"
            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <X size={14} strokeWidth={2} />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
