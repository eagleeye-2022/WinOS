"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Calendar as CalendarIcon, Loader2, Plus, X } from "lucide-react";
import { addTaskAfterReview, type AddTaskAfterReviewState } from "../actions/add-task-after-review";
import { fetchUserProjectsWithTasksAction } from "../actions/get-user-project-tasks";
import type { CascadingProjectOption } from "../queries";

function findSelectedTaskMeta(
  cascadingProjects: CascadingProjectOption[],
  selectedId: string
): { code?: string | null; title?: string } | null {
  if (!selectedId) return null;
  for (const p of cascadingProjects) {
    for (const t of p.tasks || []) {
      if (t.id === selectedId) return { code: t.code, title: t.title };
      if (t.subtasks) {
        for (const st of t.subtasks) {
          if (st.id === selectedId) return { code: st.code, title: st.title };
        }
      }
    }
  }
  return null;
}

export function AddTaskAfterReviewRow({
  entryId,
  userId,
}: {
  entryId: string;
  userId?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [cascadingProjects, setCascadingProjects] = useState<CascadingProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedSubtaskId, setSelectedSubtaskId] = useState("");
  const [selectedProjectTaskId, setSelectedProjectTaskId] = useState("");
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState<string>("");

  const [state, action, pending] = useActionState<AddTaskAfterReviewState, FormData>(
    addTaskAfterReview,
    {}
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUserProjectsWithTasksAction(userId).then((res) => {
      if (res) setCascadingProjects(res);
    });
  }, [userId]);

  const resetForm = () => {
    setSelectedProjectId("");
    setSelectedTaskId("");
    setSelectedSubtaskId("");
    setSelectedProjectTaskId("");
    setText("");
    setDueDate("");
    setAdding(false);
  };

  const handleProjectChange = (pId: string) => {
    setSelectedProjectId(pId);
    setSelectedTaskId("");
    setSelectedSubtaskId("");
    setSelectedProjectTaskId("");
  };

  const handleTaskChange = (tId: string) => {
    setSelectedTaskId(tId);
    const proj = cascadingProjects.find((p) => p.id === selectedProjectId);
    const chosen = proj?.tasks.find((t) => t.id === tId);
    if (chosen && chosen.subtasks && chosen.subtasks.length > 0) {
      setSelectedSubtaskId("");
      setSelectedProjectTaskId("");
    } else {
      setSelectedSubtaskId("");
      setSelectedProjectTaskId(chosen?.id || "");
      if (!text.trim() && chosen) {
        setText(chosen.title);
      }
    }
  };

  const handleSubtaskChange = (stId: string) => {
    setSelectedSubtaskId(stId);
    const proj = cascadingProjects.find((p) => p.id === selectedProjectId);
    const chosenTask = proj?.tasks.find((t) => t.id === selectedTaskId);
    const chosenSubtask = chosenTask?.subtasks?.find((st) => st.id === stId);
    setSelectedProjectTaskId(stId || chosenTask?.id || "");
    if (chosenSubtask && (!text.trim() || text === chosenTask?.title)) {
      setText(chosenSubtask.title);
    }
  };

  const currentProject = cascadingProjects.find((p) => p.id === selectedProjectId);
  const currentTask = currentProject?.tasks?.find((t) => t.id === selectedTaskId);
  const selectedMeta = findSelectedTaskMeta(cascadingProjects, selectedProjectTaskId);

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="mt-2.5 flex items-center justify-center gap-1.5 w-full rounded-lg border border-dashed py-2 text-xs font-medium text-primary/70 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary dark:text-[#3B82F6] dark:hover:text-[#2563EB] dark:border-[#3B82F6]/40"
      >
        <Plus size={13} className="dark:text-[#93C5FD]" /> Add Task (After Review)
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await action(fd);
        resetForm();
      }}
      className="mt-3 flex flex-col gap-2.5 rounded-xl border border-primary/40 bg-card p-3 shadow-xs"
    >
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="kind" value="TODAY" />
      <input type="hidden" name="projectTaskId" value={selectedProjectTaskId} />
      <input type="hidden" name="priority" value="" />

      {/* Cascading Project/Task/Subtask selectors temporarily disabled — Projects module not part of this deploy
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="font-semibold text-muted-foreground uppercase text-[11px]">New Task:</span>

        <div className="relative flex items-center">
          <select
            value={selectedProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="cursor-pointer appearance-none rounded-md border bg-background py-1 pl-2 pr-6 text-xs font-medium text-foreground outline-none hover:border-primary focus:border-primary max-w-[170px] truncate"
          >
            <option value="">Select Project</option>
            {cascadingProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-1.5 text-muted-foreground" />
        </div>

        {currentProject && (
          <div className="relative flex items-center">
            <select
              value={selectedTaskId}
              onChange={(e) => handleTaskChange(e.target.value)}
              className="cursor-pointer appearance-none rounded-md border bg-background py-1 pl-2 pr-6 text-xs font-medium text-foreground outline-none hover:border-primary focus:border-primary max-w-[200px] truncate"
            >
              <option value="">{currentProject.tasks.length === 0 ? "No tasks" : "Select Task"}</option>
              {currentProject.tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.code ? `[${t.code}] ` : ""}{t.title}</option>
              ))}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-1.5 text-muted-foreground" />
          </div>
        )}

        {currentTask && currentTask.subtasks && currentTask.subtasks.length > 0 && (
          <div className="relative flex items-center">
            <select
              value={selectedSubtaskId}
              onChange={(e) => handleSubtaskChange(e.target.value)}
              className="cursor-pointer appearance-none rounded-md border bg-background py-1 pl-2 pr-6 text-xs font-medium text-foreground outline-none hover:border-primary focus:border-primary max-w-[180px] truncate"
            >
              <option value="">Select Subtask</option>
              {currentTask.subtasks.map((st) => (
                <option key={st.id} value={st.id}>{st.code ? `[${st.code}] ` : ""}{st.title}</option>
              ))}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-1.5 text-muted-foreground" />
          </div>
        )}
      </div>
      */}

      {/* Task input */}
      <div className="flex items-center gap-2">
        {/* Project/task code chip temporarily disabled — Projects module not part of this deploy
        {selectedMeta?.code && (
          <span className="rounded bg-primary/10 border border-primary/20 px-2 py-1 text-xs font-mono font-bold text-primary shrink-0">
            {selectedMeta.code}
          </span>
        )}
        */}
        <input
          ref={inputRef}
          name="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          placeholder="Task description..."
          className="flex-1 rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Priority, Due Date, Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-t pt-2 border-border/50">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Due Date */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
            <CalendarIcon size={12} className="text-muted-foreground" />
            <span className="font-bold uppercase tracking-wider text-[11px]">Due:</span>
            <input
              type="date"
              name="dueDate"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="cursor-pointer bg-transparent text-xs text-foreground outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="submit"
            disabled={pending || !text.trim()}
            title="Add task"
            className="flex items-center gap-1 rounded-md bg-success/10 px-2.5 py-1.5 text-xs font-semibold text-success hover:bg-success/20 transition-colors disabled:opacity-50"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2.5} />}
            Add Task
          </button>
          <button
            type="button"
            onClick={resetForm}
            title="Cancel"
            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X size={14} strokeWidth={2} />
            Cancel
          </button>
        </div>
      </div>

      {state.message && state.message !== "created" && (
        <p className="text-xs text-destructive">{state.message}</p>
      )}
    </form>
  );
}
