"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Loader2, AlertCircle, Share2, Copy, Check, Users, ListTodo } from "lucide-react";
import {
  getProjectByIdAction,
  getTasksAction,
  updateTaskAction,
  createTaskAction,
  getMyTaskCountAction,
} from "@/features/projects/actions/project-actions";
import { Project, TaskItem } from "@/features/projects/types";
import { TasksBoardView } from "@/features/projects/components/views/tasks-board-view";
import { ProjectUsersView } from "@/features/projects/components/views/project-users-view";

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
  const [activeTab, setActiveTab] = useState<"TASKS" | "USERS">("TASKS");
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
      await createTaskAction(
        {
          title: newTask.title,
          phaseCode: newTask.phaseCode,
          phaseName: newTask.phaseName,
          status: newTask.status,
          owner: newTask.owner,
          owners: newTask.owners,
          associatedTeam: newTask.associatedTeam,
          departmentAlias: newTask.departmentAlias,
          priority: newTask.priority,
          tags: newTask.tags,
          description: newTask.description,
        },
        projectId
      );
    } catch (err) {
      console.error("Failed to persist task in DB:", err);
    }
  };

  const handleUpdateTask = async (updatedTask: TaskItem) => {
    const previous = tasks.find((t) => t.id === updatedTask.id);
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    const result = await updateTaskAction(updatedTask.id, updatedTask);
    if (!result.success) {
      if (previous) {
        setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? previous : t)));
      }
      alert(result.error || "You do not have permission to edit this task.");
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b px-6 py-3 bg-card gap-3">
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
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Owner: <span className="font-medium text-foreground">{project.owner.name}</span> &bull; Status:{" "}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{project.status}</span> &bull;{" "}
              {completedTasksCount}/{totalTasksCount} Tasks Completed ({progressPercent}%)
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("TASKS")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-all ${
              activeTab === "TASKS"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <ListTodo size={14} />
            <span>Tasks</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("USERS")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-all ${
              activeTab === "USERS"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <Users size={14} />
            <span>Project Users</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "TASKS" && (
          <TasksBoardView
            tasks={tasks}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            assignedToMeCount={assignedToMeCount}
            projectCode={project.id}
            projectName={project.name}
          />
        )}

        {activeTab === "USERS" && (
          <ProjectUsersView projectId={project.id} projectName={project.name} />
        )}
      </div>
    </div>
  );
}
