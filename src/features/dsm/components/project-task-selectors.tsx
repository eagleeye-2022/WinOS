"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { toast } from "@/components/shared/toast";
import { ProjectTaskStatusPill } from "./project-task-status-pill";
import { createDsmProjectTaskAction } from "../actions/create-project-items";
import type { CascadingProjectOption, CascadingTaskOption } from "../queries";

const selectCls = "text-xs font-medium text-foreground hover:text-primary transition-colors";

function Divider() {
  return <div className="h-3.5 w-px bg-border shrink-0" />;
}

/**
 * Project → Task list → Task → Subtask pickers for a DSM task row. Task lists can only be picked
 * here (they're created on the project's board); tasks can be created in place inside the chosen
 * list (type a title in the search box) — they're added to `projects` via `onProjectsChange`,
 * selected immediately, and show up in the Projects module too.
 */
export function ProjectTaskSelectors({
  projects,
  projectsLoading,
  projectId,
  taskListCode,
  taskId,
  subtaskId,
  onProjectChange,
  onTaskListChange,
  onTaskChange,
  onSubtaskChange,
  onProjectsChange,
  taskOwnerId,
}: {
  /** Owner of tasks created here — set when a manager adds a task for a member. Defaults to the current user. */
  taskOwnerId?: string;
  projects: CascadingProjectOption[];
  projectsLoading: boolean;
  projectId: string;
  taskListCode: string;
  taskId: string;
  subtaskId: string;
  onProjectChange: (projectId: string) => void;
  onTaskListChange: (taskListCode: string) => void;
  onTaskChange: (task: CascadingTaskOption | undefined) => void;
  onSubtaskChange: (subtaskId: string, parent: CascadingTaskOption | undefined) => void;
  onProjectsChange: (update: (prev: CascadingProjectOption[]) => CascadingProjectOption[]) => void;
}) {
  const [creating, startCreate] = useTransition();

  const project = projects.find((p) => p.id === projectId);
  const visibleTasks = project
    ? taskListCode
      ? project.tasks.filter((t) => t.phaseCode === taskListCode)
      : project.tasks
    : [];
  const task = project?.tasks.find((t) => t.id === taskId);
  const subtask = task?.subtasks.find((st) => st.id === subtaskId);
  // The status pill edits whatever the row is linked to: the subtask if one is picked, else the task.
  const linked = subtask ?? task;

  const updateProject = (pid: string, fn: (p: CascadingProjectOption) => CascadingProjectOption) =>
    onProjectsChange((prev) => prev.map((p) => (p.id === pid ? fn(p) : p)));

  /** Keeps a task's or subtask's status in the picker data in step with the status pill. */
  const setLocalStatus = (pid: string, id: string, status: string) =>
    updateProject(pid, (p) => ({
      ...p,
      tasks: p.tasks.map((t) => ({
        ...t,
        status: t.id === id ? status : t.status,
        subtasks: t.subtasks.map((st) => (st.id === id ? { ...st, status } : st)),
      })),
    }));

  const createTask = (title: string) => {
    if (!project || !taskListCode) return;
    const pid = project.id;
    startCreate(async () => {
      const res = await createDsmProjectTaskAction(pid, { title, taskListCode, ownerUserId: taskOwnerId });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      updateProject(pid, (p) => ({ ...p, tasks: [res.task, ...p.tasks] }));
      onTaskChange(res.task);
      toast.success(`Task ${res.task.code ?? ""} created`.trim());
    });
  };

  return (
    <>
      <SearchableSelect
        value={projectId}
        onChange={onProjectChange}
        options={projects.map((p) => ({ value: p.id, label: p.name }))}
        placeholder={projectsLoading ? "Loading..." : projects.length === 0 ? "No projects" : "Select Project"}
        searchPlaceholder="Search projects..."
        className={`${selectCls} max-w-[180px]`}
      />

      {project && (
        <>
          <Divider />
          <SearchableSelect
            value={taskListCode}
            onChange={onTaskListChange}
            options={project.taskLists.map((l) => ({ value: l.code, label: l.name }))}
            placeholder="All task lists"
            searchPlaceholder="Search task lists..."
            className={`${selectCls} max-w-[180px]`}
          />
          <Divider />
          <SearchableSelect
            value={taskId}
            onChange={(v) => onTaskChange(project.tasks.find((t) => t.id === v))}
            options={visibleTasks.map((t) => ({
              value: t.id,
              label: `${t.code ? `[${t.code}] ` : ""}${t.title}`,
            }))}
            placeholder={visibleTasks.length === 0 ? (taskListCode ? "No tasks — type to add" : "No tasks") : "Select Task"}
            searchPlaceholder={taskListCode ? "Search tasks..." : "Search tasks (pick a task list to add one)..."}
            onCreate={taskListCode ? createTask : undefined}
            createNoun="task"
            className={`${selectCls} max-w-[200px]`}
          />
        </>
      )}

      {task && task.subtasks.length > 0 && (
        <>
          <Divider />
          <SearchableSelect
            value={subtaskId}
            onChange={(v) => onSubtaskChange(v, task)}
            options={task.subtasks.map((st) => ({
              value: st.id,
              label: `${st.code ? `[${st.code}] ` : ""}${st.title}`,
            }))}
            placeholder="Select Subtask"
            searchPlaceholder="Search subtasks..."
            className={`${selectCls} max-w-[180px]`}
          />
        </>
      )}

      {project && linked && (
        <>
          <Divider />
          <ProjectTaskStatusPill
            key={linked.id}
            taskId={linked.id}
            status={linked.status}
            label={linked.code ?? linked.title}
            onStatusChange={(s) => setLocalStatus(project.id, linked.id, s)}
          />
        </>
      )}

      {creating && <Loader2 size={13} className="animate-spin text-muted-foreground shrink-0" aria-label="Creating..." />}
    </>
  );
}
