"use client";

import React, { useState, useEffect } from "react";
import { ListTodo, Loader2, AlertCircle, AlertTriangle } from "lucide-react";
import { getMyTasksAction, updateTaskAction } from "@/features/projects/actions/project-actions";
import { TaskItem } from "@/features/projects/types";
import { TasksBoardView } from "@/features/projects/components/views/tasks-board-view";

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMyTasks() {
      setIsLoading(true);
      setError(null);
      try {
        const myTasks = await getMyTasksAction();
        setTasks(myTasks);
      } catch (err) {
        console.error("Failed to load user tasks:", err);
        setError("Failed to load your assigned tasks.");
      } finally {
        setIsLoading(false);
      }
    }
    loadMyTasks();
  }, []);

  const handleAddTask = (newTask: TaskItem) => {
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleUpdateTask = async (updatedTask: TaskItem) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    await updateTaskAction(updatedTask.id, updatedTask);
  };

  const unassignedCount = tasks.filter((t) => !t.owner || t.owner === "Unassigned").length;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center space-y-2">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b px-6 py-4 bg-card">
        <div className="flex items-center gap-3">
          <ListTodo size={22} className="text-primary" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">My Assigned Tasks</h1>
            <p className="text-xs text-muted-foreground">
              Cross-project task list filtered by your active user assignment.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
            {tasks.length} Assigned Task{tasks.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Required-Owner Workflow Nudge Banner */}
      {unassignedCount > 0 && (
        <div className="flex items-center justify-between bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 text-xs text-amber-700 dark:text-amber-300 font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500 shrink-0" />
            <span>
              Workflow Nudge: <strong>{unassignedCount} tasks</strong> in your workspace currently have no assigned owner.
            </span>
          </div>
          <span className="text-[11px] font-mono">Required-Owner Policy</span>
        </div>
      )}

      {/* Tasks Board View */}
      <div className="flex-1 overflow-hidden">
        <TasksBoardView
          tasks={tasks}
          onAddTask={handleAddTask}
          onUpdateTask={handleUpdateTask}
          assignedToMeCount={tasks.length}
        />
      </div>
    </div>
  );
}
