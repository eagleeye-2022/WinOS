"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Loader2, AlertCircle } from "lucide-react";
import { getProjectsAction, getTasksAction, updateTaskAction } from "@/features/projects/actions/project-actions";
import { Project, TaskItem } from "@/features/projects/types";
import { TasksBoardView } from "@/features/projects/components/views/tasks-board-view";
import { TimerWidget } from "@/features/projects/components/timer-widget";

export default function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProjectData() {
      setIsLoading(true);
      setError(null);
      try {
        const [allProjects, allTasks] = await Promise.all([
          getProjectsAction(),
          getTasksAction(),
        ]);
        const found = allProjects.find(
          (p) => p.id.toLowerCase() === projectId.toLowerCase() || p.name.toLowerCase() === projectId.toLowerCase()
        );
        if (found) {
          setProject(found);
        } else {
          setProject({
            id: projectId,
            name: projectId,
            progressPercent: 0,
            owner: { id: "user-default", name: "Project Lead", initials: "PL", avatarColor: "bg-primary" },
            status: "ACTIVE",
            totalHours: "00:00 h",
            billableHours: "00:00 h",
            nonBillableHours: "00:00 h",
            startDate: new Date().toISOString().split("T")[0],
            deadline: new Date().toISOString().split("T")[0],
            completedTasksCount: 0,
            totalTasksCount: 0,
            taskProgressPercent: 0,
            completedPhasesCount: 0,
            totalPhasesCount: 0,
            createdAt: new Date().toISOString(),
          });
        }
        setTasks(allTasks);
      } catch (err) {
        console.error("Failed to load project details:", err);
        setError("Failed to load project details");
      } finally {
        setIsLoading(false);
      }
    }
    loadProjectData();
  }, [projectId]);

  const handleAddTask = (newTask: TaskItem) => {
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleUpdateTask = async (updatedTask: TaskItem) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    await updateTaskAction(updatedTask.id, updatedTask);
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
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {project.id}
              </span>
            </div>

          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <p className="text-xs text-muted-foreground mt-0.5">
            Owner: <span className="font-medium text-foreground">{project.owner.name}</span> &bull; Status:{" "}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{project.status}</span>
          </p>
        </div>
      </div>

      {/* Main Tasks Board View for this Project */}
      <div className="flex-1 overflow-hidden">
        <TasksBoardView
          tasks={tasks}
          onAddTask={handleAddTask}
          onUpdateTask={handleUpdateTask}
        />
      </div>
    </div>
  );
}
