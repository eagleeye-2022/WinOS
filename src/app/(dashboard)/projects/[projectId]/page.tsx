"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Loader2, AlertCircle, Share2, Copy, Check } from "lucide-react";
import {
  getProjectByIdAction,
  getTasksAction,
  updateTaskAction,
  createTaskAction,
  getMyTaskCountAction,
} from "@/features/projects/actions/project-actions";
import { Project, TaskItem } from "@/features/projects/types";
import { TasksBoardView } from "@/features/projects/components/views/tasks-board-view";

const RECENT_PROJECTS_KEY = "winos:recentProjects";
const RECENT_PROJECTS_LIMIT = 4;

function rememberRecentProject(project: Project) {
  try {
    const stored = window.localStorage.getItem(RECENT_PROJECTS_KEY);
    const existing: { id: string; name: string }[] = stored ? JSON.parse(stored) : [];
    const next = [
      { id: project.id, name: project.name },
      ...existing.filter((p) => p.id !== project.id),
    ].slice(0, RECENT_PROJECTS_LIMIT);
    window.localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — recent-projects shortcuts are a soft nicety, not critical path.
  }
}

export default function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [assignedToMeCount, setAssignedToMeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    async function loadProjectData() {
      setIsLoading(true);
      setError(null);
      try {
        const [foundProject, projectTasks, myTaskCount] = await Promise.all([
          getProjectByIdAction(projectId),
          getTasksAction(projectId),
          getMyTaskCountAction(projectId),
        ]);

        if (foundProject) {
          setProject(foundProject);
          setTasks(projectTasks);
          setAssignedToMeCount(myTaskCount);
          rememberRecentProject(foundProject);
        } else {
          setError(`Project "${projectId}" not found.`);
        }
      } catch (err) {
        console.error("Failed to load project details:", err);
        setError("Failed to load project details.");
      } finally {
        setIsLoading(false);
      }
    }
    loadProjectData();
  }, [projectId]);

  const completedTasksCount = tasks.filter((t) => t.status === "Closed").length;
  const totalTasksCount = tasks.length;
  const progressPercent =
    totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  const handleAddTask = async (newTask: TaskItem) => {
    setTasks((prev) => [newTask, ...prev]);
    try {
      await createTaskAction({
        title: newTask.title,
        phaseCode: newTask.phaseCode,
        phaseName: newTask.phaseName,
        status: newTask.status,
        owner: newTask.owner,
        associatedTeam: newTask.associatedTeam,
        departmentAlias: newTask.departmentAlias,
        priority: newTask.priority,
        tags: newTask.tags,
        description: newTask.description,
      });
    } catch (err) {
      console.error("Failed to persist task in DB:", err);
    }
  };

  const handleUpdateTask = async (updatedTask: TaskItem) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    await updateTaskAction(updatedTask.id, updatedTask);
  };

  const handleCopyProjectLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center space-y-2">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6 text-destructive flex items-center gap-2">
        <AlertCircle size={20} />
        <span>{error || "Project not found"}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4 bg-card">
        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Back to All Projects"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{project.name}</h1>
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary font-mono">
                {project.id}
              </span>
              <span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground font-mono">
                {project.departmentAlias}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Owner: <span className="font-medium text-foreground">{project.owner.name}</span> &bull; Status:{" "}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{project.status}</span> &bull;{" "}
              {completedTasksCount}/{totalTasksCount} Tasks Completed ({progressPercent}%)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleCopyProjectLink}
            className="flex items-center gap-1.5 rounded border border-input bg-background px-3 py-1.5 font-semibold hover:bg-accent text-foreground transition-colors"
          >
            {copiedLink ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            <span>{copiedLink ? "Link Copied!" : "Copy Project Link"}</span>
          </button>
        </div>
      </div>

      {/* Main Tasks Board View for this Project */}
      <div className="flex-1 overflow-hidden">
        <TasksBoardView
          tasks={tasks}
          onAddTask={handleAddTask}
          onUpdateTask={handleUpdateTask}
          assignedToMeCount={assignedToMeCount}
          projectCode={project.id}
          projectName={project.name}
        />
      </div>
    </div>
  );
}
