"use client";

import { useState } from "react";
import { FolderGit2, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CascadingProjectOption } from "@/features/dsm/queries";
import { TimerWidget } from "./timer-widget";

export type SelectedTaskPayload = {
  id: string;
  code: string;
  title: string;
  projectId: string;
  isSubtask: boolean;
};

interface ProjectTaskCascadingPickerProps {
  projects: CascadingProjectOption[];
  selectedTaskId?: string;
  onSelectTask: (task: SelectedTaskPayload | null) => void;
  className?: string;
}

export function ProjectTaskCascadingPicker({
  projects,
  selectedTaskId,
  onSelectTask,
  className,
}: ProjectTaskCascadingPickerProps) {
  // Helper to resolve selections from selectedTaskId prop
  const resolveSelection = (targetId?: string) => {
    if (!targetId || !projects || projects.length === 0) return { pId: "", tId: "", stId: "" };
    for (const p of projects) {
      for (const t of p.tasks || []) {
        if (t.id === targetId) {
          return { pId: p.id, tId: t.id, stId: "" };
        }
        if (t.subtasks) {
          for (const st of t.subtasks) {
            if (st.id === targetId) {
              return { pId: p.id, tId: t.id, stId: st.id };
            }
          }
        }
      }
    }
    return { pId: "", tId: "", stId: "" };
  };

  const [prevSelectedTaskId, setPrevSelectedTaskId] = useState(selectedTaskId);
  const [projectId, setProjectId] = useState(() => resolveSelection(selectedTaskId).pId);
  const [taskId, setTaskId] = useState(() => resolveSelection(selectedTaskId).tId);
  const [subtaskId, setSubtaskId] = useState(() => resolveSelection(selectedTaskId).stId);

  if (prevSelectedTaskId !== selectedTaskId) {
    setPrevSelectedTaskId(selectedTaskId);
    const resolved = resolveSelection(selectedTaskId);
    setProjectId(resolved.pId);
    setTaskId(resolved.tId);
    setSubtaskId(resolved.stId);
  }

  // Derive selected project object
  const currentProject = projects.find((p) => p.id === projectId);
  // Derive selected task object
  const currentTask = currentProject?.tasks?.find((t) => t.id === taskId);
  // Derive selected subtask object
  const currentSubtask = currentTask?.subtasks?.find((st) => st.id === subtaskId);

  // Active target task ID for starting timer or submitting
  const activeTargetTask = currentSubtask || currentTask;

  // Handle Project Change
  const handleProjectChange = (newProjectId: string) => {
    setProjectId(newProjectId);
    setTaskId("");
    setSubtaskId("");
    onSelectTask(null);
  };

  // Handle Task Change
  const handleTaskChange = (newTaskId: string) => {
    setTaskId(newTaskId);
    setSubtaskId("");
    if (!newTaskId) {
      onSelectTask(null);
      return;
    }
    const t = currentProject?.tasks.find((item) => item.id === newTaskId);
    if (t) {
      // If task has no subtasks, emit immediately
      if (!t.subtasks || t.subtasks.length === 0) {
        onSelectTask({
          id: t.id,
          code: t.code,
          title: t.title,
          projectId: currentProject?.id || "",
          isSubtask: false,
        });
      } else {
        onSelectTask(null);
      }
    }
  };

  // Handle Subtask Change
  const handleSubtaskChange = (newSubtaskId: string) => {
    setSubtaskId(newSubtaskId);
    if (newSubtaskId) {
      const st = currentTask?.subtasks?.find((item) => item.id === newSubtaskId);
      if (st) {
        onSelectTask({
          id: st.id,
          code: st.code,
          title: st.title,
          projectId: currentProject?.id || "",
          isSubtask: true,
        });
      }
    } else if (currentTask) {
      onSelectTask({
        id: currentTask.id,
        code: currentTask.code,
        title: currentTask.title,
        projectId: currentProject?.id || "",
        isSubtask: false,
      });
    }
  };

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap sm:flex-nowrap min-w-0", className)}>
      {/* 1. Project Selector */}
      <div className="flex items-center gap-1 min-w-0">
        <FolderGit2 size={12} className="text-muted-foreground shrink-0" />
        <select
          value={projectId}
          onChange={(e) => handleProjectChange(e.target.value)}
          className="cursor-pointer bg-transparent text-xs outline-none rounded px-1.5 py-1 border border-border text-foreground hover:border-primary/40 max-w-[130px] sm:max-w-[155px] truncate"
        >
          <option value="" className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">{projects.length === 0 ? "Loading projects..." : "1. Select Project..."}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id} className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">
              {p.code ? `[${p.code}] ` : ""}{p.name}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Task Selector */}
      <div className="flex items-center gap-1 min-w-0">
        <CheckSquare size={12} className="text-muted-foreground shrink-0" />
        <select
          value={taskId}
          disabled={!projectId}
          onChange={(e) => handleTaskChange(e.target.value)}
          className={cn(
            "text-xs outline-none rounded px-1.5 py-1 border border-border text-foreground max-w-[140px] sm:max-w-[165px] truncate transition-colors",
            !projectId
              ? "opacity-50 cursor-not-allowed bg-muted/20"
              : "cursor-pointer bg-transparent hover:border-primary/40"
          )}
        >
          <option value="" className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">{!projectId ? "2. Select Task..." : currentProject?.tasks?.length === 0 ? "No tasks found" : "2. Select Task..."}</option>
          {(currentProject?.tasks || []).map((t) => (
            <option key={t.id} value={t.id} className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">
              [{t.code}] {t.title} {t.subtasks?.length > 0 ? `(${t.subtasks.length} subtasks)` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Subtask Selector (Visible if chosen task has subtasks) */}
      {taskId && currentTask && currentTask.subtasks && currentTask.subtasks.length > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subtask:</span>
          <select
            value={subtaskId}
            onChange={(e) => handleSubtaskChange(e.target.value)}
            className="cursor-pointer bg-transparent text-xs outline-none rounded px-1.5 py-1 border border-border text-foreground hover:border-primary/40 max-w-[170px] truncate"
          >
            <option value="" className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">3. Subtask (Optional)...</option>
            {currentTask.subtasks.map((st) => (
              <option key={st.id} value={st.id} className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">
                [{st.code}] {st.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 4. Timer Widget (Identical to Project Module Timer with live time counter) */}
      <TimerWidget
        taskId={activeTargetTask?.id}
        taskCode={activeTargetTask?.code}
        taskTitle={activeTargetTask?.title}
        projectId={currentProject?.id}
        canStart={!!activeTargetTask}
        disabledReason="Select a project and task to start timer"
        defaultExpanded={true}
      />
    </div>
  );
}
