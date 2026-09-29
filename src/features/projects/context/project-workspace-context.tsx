"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  getProjectWorkspaceAction,
  type ProjectWorkspaceData,
} from "../actions/project-actions";
import { Project, TaskItem } from "../types";

type ProjectWorkspaceContextValue = {
  projectId: string;
  project: Project | null;
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  myTaskCount: number;
  owners: ProjectWorkspaceData["owners"];
  currentUser: ProjectWorkspaceData["currentUser"] | null;
  isLoading: boolean;
  error: string | null;
  /** Re-fetches from the DB without blanking the current UI. */
  refresh: () => Promise<void>;
};

const ProjectWorkspaceContext = createContext<ProjectWorkspaceContextValue | null>(null);

/**
 * Per-project snapshot kept for the life of the browser tab, so re-opening a project you've
 * already visited (e.g. /projects → back into /projects/EEDP-3) paints instantly from memory
 * while a fresh copy loads in the background. Written only from effects/callbacks, i.e. only
 * in the browser — never shared between users during server rendering.
 */
const workspaceCacheByProject = new Map<string, { data: ProjectWorkspaceData; tasks: TaskItem[] }>();
// Large projects are 1–2MB each in memory (851 tasks ≈ 1MB+), so keep only the recent few.
const MAX_CACHED_PROJECTS = 5;

function rememberWorkspace(projectId: string, data: ProjectWorkspaceData, tasks: TaskItem[]) {
  workspaceCacheByProject.delete(projectId);
  workspaceCacheByProject.set(projectId, { data, tasks });
  // Evict the least-recently used project so memory stays bounded.
  if (workspaceCacheByProject.size > MAX_CACHED_PROJECTS) {
    const oldest = workspaceCacheByProject.keys().next().value;
    if (oldest !== undefined) workspaceCacheByProject.delete(oldest);
  }
}

/**
 * Loads a project's board data once and shares it across `/projects/[projectId]` and every
 * `/projects/[projectId]/tasks/[taskId]` page. Mounted in the `[projectId]` layout, which Next
 * keeps alive across child navigations — so opening a task, a subtask, or going back to the
 * board reuses this state instead of re-fetching the whole project each time. Optimistic task
 * edits made on either page go through the shared `setTasks`, keeping both views in sync.
 */
export function ProjectWorkspaceProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const [cached] = useState(() => workspaceCacheByProject.get(projectId) ?? null);
  const [data, setData] = useState<ProjectWorkspaceData | null>(cached?.data ?? null);
  const [tasks, setTasks] = useState<TaskItem[]>(cached?.tasks ?? []);
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isCancelled: () => boolean = () => false, hasFallback = false) => {
      try {
        const result = await getProjectWorkspaceAction(projectId);
        if (isCancelled()) return;
        setData(result);
        setTasks(result.tasks);
        setError(result.project ? null : `Project "${projectId}" not found.`);
      } catch (err) {
        if (isCancelled()) return;
        console.error("Failed to load project workspace:", err);
        // A failed background refresh keeps the cached copy on screen.
        if (!hasFallback) setError("Failed to load project details.");
      }
    },
    [projectId]
  );

  useEffect(() => {
    let cancelled = false;
    const hasCached = workspaceCacheByProject.has(projectId);
    if (!hasCached) setIsLoading(true);
    load(() => cancelled, hasCached).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load, projectId]);

  // Keep the cache in step with what's on screen, including optimistic task edits.
  useEffect(() => {
    if (data?.project) rememberWorkspace(projectId, data, tasks);
  }, [projectId, data, tasks]);

  return (
    <ProjectWorkspaceContext.Provider
      value={{
        projectId,
        project: data?.project ?? null,
        tasks,
        setTasks,
        myTaskCount: data?.myTaskCount ?? 0,
        owners: data?.owners ?? [],
        currentUser: data?.currentUser ?? null,
        isLoading,
        error,
        refresh: () => load(),
      }}
    >
      {children}
    </ProjectWorkspaceContext.Provider>
  );
}

export function useProjectWorkspace(): ProjectWorkspaceContextValue {
  const ctx = useContext(ProjectWorkspaceContext);
  if (!ctx) {
    throw new Error("useProjectWorkspace must be used inside <ProjectWorkspaceProvider>.");
  }
  return ctx;
}
