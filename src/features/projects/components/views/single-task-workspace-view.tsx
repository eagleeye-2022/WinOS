"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Plus,
  MoreHorizontal,
  UserPlus,
  Maximize2,
  AlertCircle,
  Info,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Code,
  Table as TableIcon,
  Quote,
  Send,
  Mail,
  FileText,
  Layers,
  Bug,
  Activity,
  Folder,
  CheckCircle2,
  Clock,
  MessageSquare,
  Paperclip,
  Share2,
  SlidersHorizontal,
  Timer,
  CheckSquare,
  User,
  Sparkles,
  Calendar,
  Trash2,
  Play,
  Pause,
  Square,
} from "lucide-react";
import { TaskItem, TaskStatus, Project, TaskSubtask, TimeLogEntry } from "../../types";
import { TimerWidget } from "../timer-widget";
import { NewTimeLogModal } from "../modals/new-time-log-modal";
import { AddSubtaskDrawer } from "../modals/add-subtask-drawer";
import { TimerStoppedModal } from "../modals/timer-stopped-modal";
import {
  getTasksAction,
  updateTaskAction,
  getProjectByIdAction,
  getOwnersAndTeamsAction,
  getTaskTimeLogsAction,
  createTimeLogAction,
  createSubtaskAction,
  updateSubtaskAction,
  deleteSubtaskAction,
  createTaskRemarkAction,
} from "../../actions/project-actions";
import { TaskMultiOwnerSelect } from "../task-multi-owner-select";

interface SingleTaskWorkspaceViewProps {
  projectId: string;
  taskId: string;
}

export function SingleTaskWorkspaceView({
  projectId,
  taskId,
}: SingleTaskWorkspaceViewProps) {
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [ownersOptions, setOwnersOptions] = useState<
    { id: string; name: string; email: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTimeLogModalOpen, setIsTimeLogModalOpen] = useState(false);

  // Selected phase filter for left sidebar task list
  const [selectedPhase, setSelectedPhase] = useState("ALL");

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [fetchedProj, fetchedTasks, fetchedOwnersRes] = await Promise.all([
          getProjectByIdAction(projectId),
          getTasksAction(projectId),
          getOwnersAndTeamsAction(),
        ]);
        if (fetchedProj) setProject(fetchedProj);
        setTasks(fetchedTasks);
        if (fetchedOwnersRes && fetchedOwnersRes.owners) {
          setOwnersOptions(fetchedOwnersRes.owners);
        }
      } catch (err) {
        console.error("Failed to load tasks for single task view:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [projectId]);

  const leftTaskItems = React.useMemo(() => {
    return tasks || [];
  }, [tasks]);

  // Current active task matching route taskId parameter
  const foundTask = React.useMemo(
    () =>
      leftTaskItems.find(
        (t) =>
          t.code.toLowerCase() === taskId.toLowerCase() ||
          t.id.toLowerCase() === taskId.toLowerCase()
      ),
    [leftTaskItems, taskId]
  );

  const activeTask = React.useMemo<TaskItem>(() => {
    if (foundTask) return foundTask;
    return {
      id: taskId,
      code: taskId,
      title: "Task " + taskId,
      phaseCode: "1.1",
      phaseName: "General",
      status: "Open" as TaskStatus,
      authorName: project?.owner.name || "System",
      owner: project?.owner.name || "Unassigned",
      description: "",
      completionPercentage: 0,
      subtasks: [],
      remarks: [],
      activities: [],
    };
  }, [foundTask, taskId, project?.owner.name]);

  const taskNotFound = !isLoading && !foundTask;

  // Active Task Form & Section States
  const [taskStatus, setTaskStatus] = useState<TaskStatus>(
    activeTask.status || "Open"
  );

  const handleStatusChange = async (newStatus: TaskStatus) => {
    setTaskStatus(newStatus);
    if (activeTask && activeTask.id) {
      const updatedTask = { ...activeTask, status: newStatus };
      setTasks((prev) =>
        prev.map((t) => (t.id === activeTask.id ? updatedTask : t))
      );
      try {
        await updateTaskAction(activeTask.id, { status: newStatus });
      } catch (err) {
        console.error("Failed to update task status in DB:", err);
      }
    }
  };

  const [descriptionOpen, setDescriptionOpen] = useState(true);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(activeTask.description || "");

  const startEditingDescription = () => {
    setDescriptionDraft(activeTask.description || "");
    setIsEditingDescription(true);
  };

  const handleSaveDescription = async () => {
    const trimmed = descriptionDraft.trim();
    setIsEditingDescription(false);
    const updatedTask = { ...activeTask, description: trimmed };
    setTasks((prev) => prev.map((t) => (t.id === activeTask.id ? updatedTask : t)));
    try {
      await updateTaskAction(activeTask.id, { description: trimmed });
    } catch (err) {
      console.error("Failed to update task description in DB:", err);
    }
  };

  const [taskInfoOpen, setTaskInfoOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | "COMMENTS"
    | "SUBTASKS"
    | "LOG_HOURS"
    | "DOCUMENTS"
    | "DEPENDENCY"
    | "STATUS_TIMELINE"
    | "BUGS"
    | "ACTIVITY"
    | "DRIVE"
    | "CHECKLIST"
  >("COMMENTS");

  const [commentText, setCommentText] = useState("");
  const [commentsList, setCommentsList] = useState<
    { id: string; author: string; text: string; time: string }[]
  >([]);

  // Subtasks State & Handlers matching reference design
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>(activeTask.subtasks || []);
  const [subtaskFilter, setSubtaskFilter] = useState("Only Subtasks");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAddSubtaskDrawerOpen, setIsAddSubtaskDrawerOpen] = useState(false);

  useEffect(() => {
    setSubtasks(activeTask.subtasks || []);
  }, [activeTask.id, activeTask.subtasks]);

  const handleAddSubtaskSubmit = async (customTitle?: string) => {
    const titleToUse = (customTitle || newSubtaskTitle).trim();
    if (!titleToUse) return;

    setNewSubtaskTitle("");

    try {
      const created = await createSubtaskAction(activeTask.id, {
        title: titleToUse,
        status: "Open",
        ownerName: activeTask.owner || "Unassigned",
        startDate: new Date().toLocaleDateString("en-GB"),
        dueDate: activeTask.dueDate || "01/01/2027",
        completed: false,
      });
      if (created) {
        const updatedSubtasks = [...subtasks, created];
        setSubtasks(updatedSubtasks);
        const updatedTask = { ...activeTask, subtasks: updatedSubtasks };
        setTasks((prev) => prev.map((t) => (t.id === activeTask.id ? updatedTask : t)));
      }
    } catch (err) {
      console.error("Failed to save subtask:", err);
    }
  };

  const handleToggleSubtask = (id: string) => {
    const target = subtasks.find((st) => st.id === id);
    if (!target) return;
    const newCompleted = !target.completed;
    const newStatus: TaskStatus = newCompleted ? "Closed" : "Open";

    const updatedSubtasks = subtasks.map((st) =>
      st.id === id ? { ...st, completed: newCompleted, status: newStatus } : st
    );
    setSubtasks(updatedSubtasks);
    const updatedTask = { ...activeTask, subtasks: updatedSubtasks };
    setTasks((prev) => prev.map((t) => (t.id === activeTask.id ? updatedTask : t)));

    updateSubtaskAction(id, { completed: newCompleted, status: newStatus }).catch((err) =>
      console.error("Failed to update subtask in DB:", err)
    );
  };

  const handleSubtaskStatusChange = (id: string, newStatus: TaskStatus) => {
    const updatedSubtasks = subtasks.map((st) =>
      st.id === id
        ? {
            ...st,
            status: newStatus,
            completed: newStatus === "Closed",
          }
        : st
    );
    setSubtasks(updatedSubtasks);
    const updatedTask = { ...activeTask, subtasks: updatedSubtasks };
    setTasks((prev) => prev.map((t) => (t.id === activeTask.id ? updatedTask : t)));

    updateSubtaskAction(id, { status: newStatus, completed: newStatus === "Closed" }).catch(
      (err) => console.error("Failed to update subtask status in DB:", err)
    );
  };

  const handleDeleteSubtask = (id: string) => {
    const updatedSubtasks = subtasks.filter((st) => st.id !== id);
    setSubtasks(updatedSubtasks);
    const updatedTask = { ...activeTask, subtasks: updatedSubtasks };
    setTasks((prev) => prev.map((t) => (t.id === activeTask.id ? updatedTask : t)));

    deleteSubtaskAction(id).catch((err) => console.error("Failed to delete subtask in DB:", err));
  };

  useEffect(() => {
    if (activeTask && activeTask.remarks && activeTask.remarks.length > 0) {
      setCommentsList(
        activeTask.remarks.map((r, idx) => ({
          id: r.id || `c-${idx}`,
          author: r.authorName || activeTask.owner || project?.owner.name || "Team Member",
          text: r.content,
          time: r.createdAt || "Recently",
        }))
      );
    } else {
      setCommentsList([]);
    }
  }, [activeTask.id, activeTask.remarks, project?.owner.name]);

  // Dynamic Time Logs State & Calculations for this specific task — loaded from the DB
  const [taskTimeLogs, setTaskTimeLogs] = useState<TimeLogEntry[]>([]);

  const refreshTaskTimeLogs = React.useCallback(() => {
    if (!activeTask.code) return;
    getTaskTimeLogsAction(activeTask.code)
      .then(setTaskTimeLogs)
      .catch((err) => console.error("Failed to load task time logs:", err));
  }, [activeTask.code]);

  useEffect(() => {
    refreshTaskTimeLogs();
  }, [refreshTaskTimeLogs]);

  const totalTaskMinutes = taskTimeLogs.reduce((sum, log) => {
    const match = log.duration.match(/(\d+):(\d+)/);
    if (!match) return sum;
    return sum + parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }, 0);

  const formatTaskMinutesShort = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const formattedTotalTaskHours = formatTaskMinutesShort(totalTaskMinutes);

  // Active Timer state shared across workspace header and Log Hours tab
  const [activeTimerSeconds, setActiveTimerSeconds] = useState<number>(0);
  const [activeTimerStatus, setActiveTimerStatus] = useState<"IDLE" | "RUNNING" | "PAUSED">("IDLE");
  const [activeTimerStartTime, setActiveTimerStartTime] = useState<Date | undefined>(undefined);
  const [isStoppedModalOpen, setIsStoppedModalOpen] = useState(false);
  const [stoppedSeconds, setStoppedSeconds] = useState<number>(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (activeTimerStatus === "RUNNING") {
      interval = setInterval(() => {
        setActiveTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTimerStatus]);

  const handleStartTimer = () => {
    if (activeTimerStatus === "IDLE") {
      setActiveTimerStartTime(new Date());
    }
    setActiveTimerStatus("RUNNING");
  };

  const handlePauseTimer = () => {
    setActiveTimerStatus("PAUSED");
  };

  const handleStopTimer = () => {
    const elapsed = activeTimerSeconds;
    setActiveTimerStatus("IDLE");
    setStoppedSeconds(elapsed > 0 ? elapsed : 8400);
    setIsStoppedModalOpen(true);
    setActiveTimerSeconds(0);
  };

  const formatHMS = (totalSecs: number): string => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  };

  const handleTimerLogSaved = async (logData: {
    duration: string;
    startTime: string;
    endTime: string;
    isBillable: boolean;
    notes: string;
  }) => {
    try {
      await createTimeLogAction(
        {
          title: activeTask.title,
          project: project?.name || projectId,
          taskCode: activeTask.code,
          duration: logData.duration,
          timePeriod: `${logData.startTime.split(" ")[1] || "10:00 AM"} - ${logData.endTime.split(" ")[1] || "11:00 AM"}`,
          date: new Date().toLocaleDateString("en-GB"),
          billingType: logData.isBillable ? "BILLABLE" : "NON BILLABLE",
          remarks: logData.notes || "Timer session logged",
          approvalStatus: "Pending",
        },
        projectId
      );
      refreshTaskTimeLogs();
    } catch (err) {
      console.error("Failed to save timer log:", err);
    }
  };

  // Dynamically compute list of unique phases from all available tasks
  const availablePhases = Array.from(
    new Set(
      leftTaskItems.map(
        (t) => `${t.phaseCode || "1.1"} ${t.phaseName || "Client On Boarding"}`
      )
    )
  );

  // Auto-sync status to match the active task when navigating to a new taskId
  const [prevTaskId, setPrevTaskId] = useState(taskId);
  if (taskId !== prevTaskId) {
    setPrevTaskId(taskId);
    setTaskStatus(activeTask.status || "Open");
    setIsEditingDescription(false);
    setDescriptionDraft(activeTask.description || "");
  }

  const handleSelectTaskCard = (code: string) => {
    router.push(`/projects/${projectId}/tasks/${code}`);
  };

  const handleAddComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setCommentText("");

    try {
      const created = await createTaskRemarkAction(activeTask.id, text);
      if (created) {
        setCommentsList((prev) => [
          ...prev,
          {
            id: created.id,
            author: created.authorName,
            text: created.content,
            time: "Just now",
          },
        ]);
      }
    } catch (err) {
      console.error("Failed to save comment:", err);
    }
  };

  // Filter sidebar task cards by selected phase
  const filteredLeftTasks = leftTaskItems.filter((item) => {
    if (selectedPhase === "ALL") return true;
    const phaseCombined = `${item.phaseCode || ""} ${item.phaseName || ""}`.trim().toLowerCase();
    return (
      phaseCombined === selectedPhase.toLowerCase() ||
      item.phaseName?.toLowerCase() === selectedPhase.toLowerCase() ||
      item.phaseCode === selectedPhase
    );
  });

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground dark:bg-[#121316]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading task workspace...</p>
        </div>
      </div>
    );
  }

  if (taskNotFound) {
    return (
      <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans dark:bg-[#121316]">
        {/* Left Sidebar Task List */}
        <aside className="w-80 border-r border-border bg-card flex flex-col shrink-0 select-none dark:border-neutral-800 dark:bg-[#16181d] p-4">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-3 dark:border-neutral-800">
            <h3 className="text-xs font-bold text-foreground">Project Tasks ({leftTaskItems.length})</h3>
            <Link href={`/projects/${projectId}`} className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              <ArrowLeft size={12} /> Project
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {leftTaskItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No tasks exist in this project yet.
              </div>
            ) : (
              leftTaskItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectTaskCard(item.code)}
                  className="rounded-xl border border-border bg-card p-3 cursor-pointer hover:border-primary/50 hover:bg-accent/40 transition-colors"
                >
                  <div className="text-[11px] font-mono text-muted-foreground">{item.code}</div>
                  <h4 className="text-xs font-semibold text-foreground line-clamp-2">{item.title}</h4>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Task Not Found Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background dark:bg-[#121316]">
          <div className="max-w-md space-y-4 rounded-2xl border border-border bg-card p-8 shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <AlertCircle size={28} />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Task Not Found</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Task <span className="font-mono font-semibold text-foreground">{taskId}</span> could not be found in project <span className="font-semibold text-foreground">{project?.name || projectId}</span>.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                href={`/projects/${projectId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors shadow-2xs"
              >
                <ArrowLeft size={14} /> Back to Project
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans dark:bg-[#121316] dark:text-neutral-100">
      {/* ── Left Sidebar Task List Column ────────────────────────────────────────── */}
      <aside className="w-80 border-r border-border bg-card flex flex-col shrink-0 select-none dark:border-neutral-800 dark:bg-[#16181d]">
        {/* Phase Header Selector */}
        <div className="flex items-center justify-between border-b border-border p-3.5 dark:border-neutral-800">
          <div className="relative flex-1 mr-2">
            <select
              value={selectedPhase}
              onChange={(e) => setSelectedPhase(e.target.value)}
              className="w-full appearance-none rounded-lg border border-border bg-card px-3 py-1.5 pr-8 text-xs font-bold text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer dark:border-neutral-700 dark:bg-[#1c1e24] dark:text-neutral-200"
            >
              {availablePhases.map((phaseLabel) => (
                <option key={phaseLabel} value={phaseLabel}>
                  {phaseLabel}
                </option>
              ))}
              <option value="ALL">All Phases</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none dark:text-neutral-400"
            />
          </div>
          <button
            type="button"
            className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-info transition-colors dark:border-neutral-800 dark:bg-[#1c1e24] dark:hover:bg-neutral-800"
            title="Filter List"
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>

        {/* Task Cards Stack */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredLeftTasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground dark:text-neutral-400">
              No tasks found in this phase.
            </div>
          ) : (
            filteredLeftTasks.map((item) => {
              const isSelected =
                item.code.toLowerCase() === taskId.toLowerCase() ||
                item.id.toLowerCase() === taskId.toLowerCase();

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectTaskCard(item.code)}
                  className={`rounded-xl border p-3 cursor-pointer transition-all duration-150 relative ${
                    isSelected
                      ? "border-info bg-info/10 ring-1 ring-info/40 shadow-2xs dark:border-sky-500 dark:bg-[#1e222a] dark:ring-sky-500/40"
                      : "border-border bg-card hover:border-border/80 hover:bg-accent/40 dark:border-neutral-800 dark:bg-[#1c1e24] dark:hover:border-neutral-700 dark:hover:bg-[#20232b]"
                  }`}
                >
                  {/* Top Badge Row */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-mono text-muted-foreground dark:text-neutral-400">
                      {item.code}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        item.status === "Closed"
                          ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400"
                          : item.status === "In Progress"
                            ? "bg-amber-500/15 text-amber-600 border border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300"
                            : "bg-info/15 text-info border border-info/30 dark:bg-sky-500/20 dark:text-sky-300"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  {/* Title */}
                  <h4
                    className={`text-xs font-semibold leading-snug line-clamp-2 ${
                      item.status === "Closed"
                        ? "line-through text-muted-foreground dark:text-neutral-400"
                        : "text-foreground dark:text-neutral-100"
                    }`}
                  >
                    {item.title}
                  </h4>

                  {/* Footer Owner & Badges */}
                  <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground dark:border-neutral-800/80 dark:text-neutral-400">
                    <span className="truncate max-w-[170px]">
                      {item.owner || "Unassigned"}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSelected && (
                        <Timer size={12} className="text-info animate-pulse dark:text-sky-400" />
                      )}
                      <AlertCircle size={12} className="text-muted-foreground/60 dark:text-neutral-500" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Main Right Task Workspace Area ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col bg-background text-foreground overflow-hidden dark:bg-[#121316] dark:text-neutral-100">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3.5 bg-card dark:border-neutral-800 dark:bg-[#16181d]">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded bg-info/15 px-2 py-0.5 text-[11px] font-bold text-info border border-info/30 dark:bg-sky-500/20 dark:text-sky-400 dark:border-sky-500/30">
                <CheckSquare size={12} /> Task
              </span>
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-foreground font-semibold dark:bg-neutral-800 dark:text-neutral-300">
                {activeTask.code}
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground tracking-tight truncate dark:text-neutral-100">
              {activeTask.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5 dark:text-neutral-400">
              <span>By {activeTask.authorName || activeTask.owner || project?.owner.name || "System"}</span>
              <span>|</span>
              <span className="flex items-center gap-1 text-foreground font-medium dark:text-neutral-300">
                <Folder size={12} className="text-info dark:text-sky-400" /> {project?.name || projectId}
              </span>
              <span>💬 📎</span>
              <span>|</span>

              {/* Embedded Live Timer Widget */}
              <TimerWidget
                taskTitle={activeTask.title}
                taskCode={activeTask.code}
                onSaveLog={handleTimerLogSaved}
              />

              <Info size={14} className="text-muted-foreground cursor-pointer hover:text-foreground dark:text-neutral-400 dark:hover:text-neutral-200" />
            </div>
          </div>

          {/* Right Header Action Icons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTimeLogModalOpen(true)}
              className="flex items-center gap-1.5 rounded-md bg-[#0088ff] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0077ee] transition-colors"
            >
              <Plus size={14} />
              <span>Time Log</span>
            </button>
            <button
              type="button"
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground transition-colors dark:border-neutral-800 dark:bg-[#1c1e24] dark:hover:bg-neutral-800 dark:text-neutral-300"
              title="More Actions"
            >
              <MoreHorizontal size={16} />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground transition-colors dark:border-neutral-800 dark:bg-[#1c1e24] dark:hover:bg-neutral-800 dark:text-neutral-300"
              title="Assign User"
            >
              <UserPlus size={16} />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground transition-colors dark:border-neutral-800 dark:bg-[#1c1e24] dark:hover:bg-neutral-800 dark:text-neutral-300"
              title="Expand View"
            >
              <Maximize2 size={16} />
            </button>
            <Link
              href={`/projects/${projectId}`}
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground hover:text-destructive transition-colors ml-1 dark:border-neutral-800 dark:bg-[#1c1e24] dark:hover:bg-neutral-800 dark:text-neutral-300 dark:hover:text-rose-400"
              title="Close Task Detail"
            >
              <X size={16} />
            </Link>
          </div>
        </div>

        {/* Workspace Body Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {taskNotFound && (
            <div className="flex items-center gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive">
              <AlertCircle size={16} className="shrink-0" />
              <span>
                Task &quot;{taskId}&quot; was not found in this project — it may belong to a
                different project or no longer exist. The fields below are placeholders, not
                real task data.
              </span>
            </div>
          )}

          {/* Status Field */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-neutral-400">
              STATUS
            </span>
            <div className="relative inline-block">
              <select
                value={taskStatus}
                onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                className="appearance-none rounded-lg border border-border bg-card px-3 py-1.5 pr-8 text-xs font-semibold text-info outline-none focus:ring-1 focus:ring-primary cursor-pointer dark:border-neutral-700 dark:bg-[#1c1e24] dark:text-sky-400"
              >
                <option value="Open">● Open</option>
                <option value="In Progress">● In Progress</option>
                <option value="Under Review">● Under Review</option>
                <option value="Approved">● Approved</option>
                <option value="Closed">● Closed</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none dark:text-neutral-400"
              />
            </div>
          </div>

          {/* Description Collapsible Section */}
          <div className="border border-border rounded-xl bg-card overflow-hidden dark:border-neutral-800 dark:bg-[#16181d]">
            <button
              type="button"
              onClick={() => setDescriptionOpen(!descriptionOpen)}
              className="flex w-full items-center justify-between p-3.5 hover:bg-accent/40 text-xs font-bold text-foreground transition-colors dark:hover:bg-neutral-800/40 dark:text-neutral-200"
            >
              <span className="flex items-center gap-2">
                {descriptionOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Description
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDescriptionOpen(true);
                    startEditingDescription();
                  }}
                  className="p-0.5 rounded hover:bg-accent"
                  title="Edit description"
                >
                  <Plus size={13} className="text-info dark:text-sky-400" />
                </span>
              </span>
            </button>
            {descriptionOpen && (
              <div className="px-4 pb-4 pt-1 text-xs text-muted-foreground border-t border-border/60 dark:text-neutral-400 dark:border-neutral-800/60">
                {isEditingDescription ? (
                  <div className="space-y-2 pt-2">
                    <textarea
                      autoFocus
                      rows={4}
                      value={descriptionDraft}
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                      placeholder="Add a description..."
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary font-sans"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveDescription}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDescriptionDraft(activeTask.description || "");
                          setIsEditingDescription(false);
                        }}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : activeTask.description ? (
                  /^https?:\/\//i.test(activeTask.description.trim()) ? (
                    <a
                      href={activeTask.description}
                      target="_blank"
                      rel="noreferrer"
                      className="text-info underline break-all hover:text-info/80 dark:text-sky-400 dark:hover:text-sky-300 font-mono"
                    >
                      {activeTask.description}
                    </a>
                  ) : (
                    <p
                      onClick={() => startEditingDescription()}
                      className="whitespace-pre-wrap break-words cursor-text hover:text-foreground transition-colors"
                    >
                      {activeTask.description}
                    </p>
                  )
                ) : (
                  <span
                    onClick={() => setIsEditingDescription(true)}
                    className="cursor-text hover:text-foreground transition-colors font-mono"
                  >
                    NO DESCRIPTION AVAILABLE
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Task Information Collapsible Section */}
          <div className="border border-border rounded-xl bg-card overflow-hidden dark:border-neutral-800 dark:bg-[#16181d]">
            <button
              type="button"
              onClick={() => setTaskInfoOpen(!taskInfoOpen)}
              className="flex w-full items-center justify-between p-3.5 hover:bg-accent/40 text-xs font-bold text-foreground transition-colors dark:hover:bg-neutral-800/40 dark:text-neutral-200"
            >
              <span className="flex items-center gap-2">
                {taskInfoOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Task Information
              </span>
            </button>
            {taskInfoOpen && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 text-xs border-t border-border/60 bg-muted/30 dark:border-neutral-800/60 dark:bg-[#1c1e24]">
                <div className="col-span-2 md:col-span-4 border-b border-border/40 pb-3 mb-1">
                  <TaskMultiOwnerSelect
                    label="Owner"
                    selectedOwners={
                      activeTask.owners && activeTask.owners.length > 0
                        ? activeTask.owners
                        : activeTask.owner && activeTask.owner !== "Unassigned"
                        ? activeTask.owner.split(",").map((s) => s.trim()).filter(Boolean)
                        : []
                    }
                    onChangeOwners={(newOwners) => {
                      const primaryOwnerStr = newOwners.length > 0 ? newOwners.join(", ") : "Unassigned";
                      const updatedTask = {
                        ...activeTask,
                        owners: newOwners,
                        owner: primaryOwnerStr,
                      };
                      setTasks((prev) =>
                        prev.map((t) => (t.id === activeTask.id ? updatedTask : t))
                      );
                      updateTaskAction(activeTask.id, {
                        owners: newOwners,
                        owner: primaryOwnerStr,
                      }).catch((err) => console.error("Failed to update task owner in DB:", err));
                    }}
                    ownersList={ownersOptions}
                  />
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] dark:text-neutral-400">Start Date</span>
                  <span className="font-medium text-foreground dark:text-neutral-100">{activeTask.startDate || "--"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] dark:text-neutral-400">Due Date</span>
                  <span className="font-medium text-foreground dark:text-neutral-100">{activeTask.dueDate || "--"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] dark:text-neutral-400">Duration</span>
                  <span className="font-medium text-foreground dark:text-neutral-100">{activeTask.duration || "2 days"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Tabs Bar & Content */}
          <div className="border border-border rounded-xl bg-card overflow-hidden dark:border-neutral-800 dark:bg-[#16181d]">
            {/* Tabs Header Scrollbar */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-3 py-2 text-xs font-semibold scrollbar-none dark:border-neutral-800">
              {[
                { key: "COMMENTS", label: "Comments" },
                { key: "SUBTASKS", label: "Subtasks" },
                { key: "LOG_HOURS", label: `Log Hours (${formattedTotalTaskHours})` },
                { key: "DOCUMENTS", label: "Documents" },
                { key: "DEPENDENCY", label: "Dependency" },
                { key: "STATUS_TIMELINE", label: "Status Timeline" },
                { key: "BUGS", label: "Bugs" },
                { key: "ACTIVITY", label: "Activity Stream" },
                { key: "DRIVE", label: "Google Drive" },
                { key: "CHECKLIST", label: "Checklist" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                    activeTab === tab.key
                      ? "bg-info/15 text-info font-bold border border-info/30 dark:bg-sky-500/20 dark:text-sky-400 dark:border-sky-500/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800/50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Body Content */}
            <div className="p-4 space-y-4">
              {activeTab === "COMMENTS" && (
                <div className="space-y-4">
                  {/* Rich Text Editor Toolbar Bar */}
                  <div className="flex flex-wrap items-center gap-1.5 rounded-t-xl border border-border bg-muted/40 p-2 text-xs text-foreground dark:border-neutral-800 dark:bg-[#1c1e24] dark:text-neutral-300">
                    <button
                      type="button"
                      onClick={handleAddComment}
                      className="p-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mr-1 dark:bg-sky-500 dark:text-white"
                      title="Send Comment"
                    >
                      <Send size={13} />
                    </button>
                    <button type="button" className="p-1 hover:bg-accent rounded dark:hover:bg-neutral-800">
                      <Bold size={13} />
                    </button>
                    <button type="button" className="p-1 hover:bg-accent rounded dark:hover:bg-neutral-800">
                      <Italic size={13} />
                    </button>
                    <button type="button" className="p-1 hover:bg-accent rounded dark:hover:bg-neutral-800">
                      <Underline size={13} />
                    </button>
                    <button type="button" className="p-1 hover:bg-accent rounded dark:hover:bg-neutral-800">
                      <Strikethrough size={13} />
                    </button>

                    <div className="h-4 w-px bg-border mx-1 dark:bg-neutral-800" />

                    <span className="text-[11px] font-medium text-muted-foreground px-1 dark:text-neutral-400">Puvi</span>
                    <span className="text-[11px] font-medium text-muted-foreground px-1 dark:text-neutral-400">13</span>

                    <div className="h-4 w-px bg-border mx-1 dark:bg-neutral-800" />

                    <button type="button" className="p-1 hover:bg-accent rounded dark:hover:bg-neutral-800">
                      <List size={13} />
                    </button>
                    <button type="button" className="p-1 hover:bg-accent rounded dark:hover:bg-neutral-800">
                      <ListOrdered size={13} />
                    </button>
                    <button type="button" className="p-1 hover:bg-accent rounded dark:hover:bg-neutral-800">
                      <LinkIcon size={13} />
                    </button>
                    <button type="button" className="p-1 hover:bg-accent rounded dark:hover:bg-neutral-800">
                      <ImageIcon size={13} />
                    </button>
                    <button type="button" className="p-1 hover:bg-accent rounded dark:hover:bg-neutral-800">
                      <Code size={13} />
                    </button>
                    <button type="button" className="p-1 hover:bg-accent rounded dark:hover:bg-neutral-800">
                      <TableIcon size={13} />
                    </button>
                    <button type="button" className="p-1 hover:bg-accent rounded dark:hover:bg-neutral-800">
                      <Quote size={13} />
                    </button>
                  </div>

                  {/* Comment Input Textarea */}
                  <textarea
                    rows={4}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment or update on this task..."
                    className="w-full rounded-b-xl border border-t-0 border-border bg-card p-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary resize-none font-sans dark:border-neutral-800 dark:bg-[#121316] dark:text-neutral-100 dark:placeholder-neutral-500 dark:focus:ring-sky-500"
                  />

                  <div className="flex items-center gap-1.5 text-[11px] text-info hover:underline cursor-pointer dark:text-sky-400">
                    <Mail size={12} />
                    <span>To add Task Comment via email</span>
                  </div>

                  {/* Comments Feed */}
                  <div className="space-y-3 pt-2">
                    {commentsList.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl border border-border/80 bg-muted/30 p-3 space-y-1 text-xs dark:border-neutral-800/80 dark:bg-[#1c1e24]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground dark:text-neutral-200">{c.author}</span>
                          <span className="text-[10px] text-muted-foreground dark:text-neutral-400">{c.time}</span>
                        </div>
                        <p className="text-foreground/90 leading-relaxed dark:text-neutral-300">{c.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "SUBTASKS" && (
                <div className="space-y-4 text-xs font-sans">
                  {/* Top Bar matching screenshot */}
                  <div className="flex items-center justify-between pb-2 border-b border-border dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-info dark:text-sky-400" />
                      <select
                        value={subtaskFilter}
                        onChange={(e) => setSubtaskFilter(e.target.value)}
                        className="bg-transparent font-bold text-foreground text-xs outline-none cursor-pointer dark:text-neutral-200"
                      >
                        <option value="Only Subtasks">Only Subtasks</option>
                        <option value="All Subtasks">All Subtasks</option>
                        <option value="Open Subtasks">Open Subtasks</option>
                        <option value="Completed Subtasks">Completed Subtasks</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsAddSubtaskDrawerOpen(true)}
                      className="flex items-center gap-1.5 rounded-md bg-[#0088ff] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0077ee] transition-colors cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Add Subtask</span>
                    </button>
                  </div>

                  {/* Table View matching screenshot */}
                  <div className="overflow-x-auto rounded-lg border border-border bg-card dark:border-neutral-800 dark:bg-[#16181d]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold dark:border-neutral-800 dark:bg-[#1c1e24] dark:text-neutral-400">
                          <th className="py-2.5 px-3 border-r border-border w-24 dark:border-neutral-800">ID</th>
                          <th className="py-2.5 px-4 border-r border-border min-w-[240px] dark:border-neutral-800">Task Name</th>
                          <th className="py-2.5 px-3 border-r border-border w-32 dark:border-neutral-800">
                            <span className="inline-flex items-center gap-1">
                              <CheckSquare size={12} /> Status
                            </span>
                          </th>
                          <th className="py-2.5 px-3 border-r border-border w-40 dark:border-neutral-800">
                            <span className="inline-flex items-center gap-1">
                              <User size={12} /> Owner
                            </span>
                          </th>
                          <th className="py-2.5 px-3 border-r border-border w-32 dark:border-neutral-800">
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={12} /> Start Date
                            </span>
                          </th>
                          <th className="py-2.5 px-3 border-r border-border w-32 dark:border-neutral-800">
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={12} /> Due Date
                            </span>
                          </th>
                          <th className="py-2.5 px-2 text-center w-10">
                            <Layers size={13} />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 dark:divide-neutral-800/60">
                        {subtasks.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-muted-foreground italic">
                              No subtasks added yet. Click &quot;Add Subtask&quot; below to create one.
                            </td>
                          </tr>
                        ) : (
                          subtasks.map((st) => (
                            <tr
                              key={st.id}
                              className="hover:bg-accent/30 transition-colors group dark:hover:bg-neutral-800/30"
                            >
                              <td className="py-2 px-3 border-r border-border font-mono text-[11px] text-muted-foreground font-semibold dark:border-neutral-800 dark:text-neutral-400">
                                {st.code}
                              </td>
                              <td className="py-2 px-4 border-r border-border font-medium text-foreground dark:border-neutral-800 dark:text-neutral-200">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={st.completed || st.status === "Closed"}
                                    onChange={() => handleToggleSubtask(st.id)}
                                    className="rounded border-input text-primary h-3.5 w-3.5 cursor-pointer"
                                  />
                                  <span className={st.completed || st.status === "Closed" ? "line-through text-muted-foreground" : ""}>
                                    {st.title}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-3 border-r border-border dark:border-neutral-800">
                                <select
                                  value={st.status}
                                  onChange={(e) => handleSubtaskStatusChange(st.id, e.target.value as TaskStatus)}
                                  className="bg-transparent text-xs font-semibold text-foreground outline-none cursor-pointer dark:text-neutral-200"
                                >
                                  <option value="Open">Open</option>
                                  <option value="In Progress">In Progress</option>
                                  <option value="Closed">Closed</option>
                                </select>
                              </td>
                              <td className="py-2 px-3 border-r border-border truncate text-muted-foreground dark:border-neutral-800 dark:text-neutral-300">
                                {st.ownerName || activeTask.owner || "Unassigned"}
                              </td>
                              <td className="py-2 px-3 border-r border-border text-muted-foreground dark:border-neutral-800 dark:text-neutral-400">
                                {st.startDate || "--"}
                              </td>
                              <td className="py-2 px-3 border-r border-border text-muted-foreground dark:border-neutral-800 dark:text-neutral-400">
                                {st.dueDate || "--"}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubtask(st.id)}
                                  className="text-muted-foreground hover:text-destructive p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                  title="Delete subtask"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}

                        {/* Inline Add Row matching user screenshot */}
                        <tr className="bg-muted/20 dark:bg-[#1c1e24]/60">
                          <td className="py-2.5 px-3 border-r border-border text-muted-foreground font-mono text-[11px] dark:border-neutral-800">
                            {activeTask.code}.{subtasks.length + 1}
                          </td>
                          <td colSpan={6} className="py-2 px-4">
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleAddSubtaskSubmit();
                              }}
                              className="flex items-center gap-3 w-full"
                            >
                              <input
                                type="text"
                                value={newSubtaskTitle}
                                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                placeholder="Add Subtask"
                                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none font-medium"
                              />

                              <button
                                type="button"
                                onClick={() => {
                                  const suggestions = [
                                    "Review Figma design guidelines",
                                    "Perform QA cross-browser test",
                                    "Update technical documentation",
                                    "Validate API response schemas",
                                    "Check mobile viewport responsiveness",
                                  ];
                                  const randomSugg = suggestions[Math.floor(Math.random() * suggestions.length)];
                                  handleAddSubtaskSubmit(randomSugg);
                                }}
                                className="flex items-center gap-1 text-[11px] font-semibold text-info hover:underline cursor-pointer shrink-0 dark:text-sky-400"
                              >
                                <Sparkles size={13} />
                                <span>Suggestions</span>
                              </button>

                              {newSubtaskTitle.trim() && (
                                <button
                                  type="submit"
                                  className="rounded bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 cursor-pointer"
                                >
                                  Add
                                </button>
                              )}
                            </form>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === "LOG_HOURS" && (
                <div className="space-y-4 text-xs font-sans">
                  {/* Live Active Running Timer Banner */}
                  {activeTimerStatus !== "IDLE" && (
                    <div className="flex flex-wrap items-center justify-between p-3.5 rounded-xl border border-sky-500/40 bg-sky-500/10 text-foreground dark:border-sky-500/40 dark:bg-sky-500/10 animate-in fade-in-0 duration-200 gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-3 w-3 items-center justify-center">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground dark:text-neutral-100">
                              {activeTimerStatus === "RUNNING" ? "Active Timer Running..." : "Timer Paused"}
                            </span>
                            <span className="text-[11px] font-mono font-semibold text-muted-foreground dark:text-neutral-400">
                              ({activeTask.code} - {activeTask.title})
                            </span>
                          </div>
                          <div className="font-mono text-lg font-extrabold text-info dark:text-sky-400 mt-0.5">
                            {formatHMS(activeTimerSeconds)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {activeTimerStatus === "RUNNING" ? (
                          <button
                            type="button"
                            onClick={handlePauseTimer}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                          >
                            <Pause size={13} fill="currentColor" />
                            <span>Pause Timer</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleStartTimer}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                          >
                            <Play size={13} fill="currentColor" />
                            <span>Resume Timer</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleStopTimer}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                        >
                          <Square size={13} fill="currentColor" />
                          <span>Stop & Log Time</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Top Bar with Total Hours Summary & Action Buttons */}
                  <div className="flex items-center justify-between pb-3 border-b border-border dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 rounded-lg bg-info/10 border border-info/20 px-3 py-1.5 text-info dark:bg-sky-500/10 dark:border-sky-500/20 dark:text-sky-400">
                        <Clock size={15} />
                        <span className="font-semibold text-xs">Total Tracked Hours:</span>
                        <strong className="font-mono text-sm font-bold">{formattedTotalTaskHours} hrs</strong>
                      </div>
                      <span className="text-muted-foreground text-xs font-medium dark:text-neutral-400">
                        ({taskTimeLogs.length} Time Log Entries)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {activeTimerStatus === "IDLE" && (
                        <button
                          type="button"
                          onClick={handleStartTimer}
                          className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors cursor-pointer"
                        >
                          <Play size={13} fill="currentColor" />
                          <span>Start Task Timer</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsTimeLogModalOpen(true)}
                        className="flex items-center gap-1.5 rounded-md bg-[#0088ff] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0077ee] transition-colors cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Add Time Log</span>
                      </button>
                    </div>
                  </div>

                  {/* Task Time Logs Table */}
                  <div className="overflow-x-auto rounded-lg border border-border bg-card dark:border-neutral-800 dark:bg-[#16181d]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold dark:border-neutral-800 dark:bg-[#1c1e24] dark:text-neutral-400">
                          <th className="py-2.5 px-3 border-r border-border whitespace-nowrap dark:border-neutral-800">Log ID</th>
                          <th className="py-2.5 px-4 border-r border-border whitespace-nowrap dark:border-neutral-800">Date</th>
                          <th className="py-2.5 px-4 border-r border-border whitespace-nowrap dark:border-neutral-800">Time Period</th>
                          <th className="py-2.5 px-4 border-r border-border whitespace-nowrap dark:border-neutral-800">Duration</th>
                          <th className="py-2.5 px-4 border-r border-border whitespace-nowrap dark:border-neutral-800">Logged By</th>
                          <th className="py-2.5 px-4 border-r border-border whitespace-nowrap dark:border-neutral-800">Billing Type</th>
                          <th className="py-2.5 px-4 border-r border-border whitespace-nowrap dark:border-neutral-800">Approval Status</th>
                          <th className="py-2.5 px-4 min-w-[200px]">Remarks / Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 dark:divide-neutral-800/60">
                        {taskTimeLogs.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-muted-foreground italic dark:text-neutral-400">
                              No time logs recorded for this task yet. Click &quot;Add Time Log&quot; to log work hours.
                            </td>
                          </tr>
                        ) : (
                          taskTimeLogs.map((log) => (
                            <tr
                              key={log.id}
                              className="hover:bg-accent/30 transition-colors dark:hover:bg-neutral-800/30"
                            >
                              <td className="py-2.5 px-3 border-r border-border font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap dark:border-neutral-800 dark:text-neutral-400">
                                {log.code}
                              </td>
                              <td className="py-2.5 px-4 border-r border-border font-mono text-[11px] text-foreground font-medium whitespace-nowrap dark:border-neutral-800 dark:text-neutral-200">
                                {log.date}
                              </td>
                              <td className="py-2.5 px-4 border-r border-border font-mono text-[11px] text-muted-foreground whitespace-nowrap dark:border-neutral-800 dark:text-neutral-400">
                                {log.timePeriod}
                              </td>
                              <td className="py-2.5 px-4 border-r border-border font-mono font-bold text-foreground whitespace-nowrap dark:border-neutral-800 dark:text-neutral-100">
                                {log.duration} hrs
                              </td>
                              <td className="py-2.5 px-4 border-r border-border font-semibold text-foreground whitespace-nowrap dark:border-neutral-800 dark:text-neutral-200">
                                {activeTask.owner || project?.owner.name || "Vaishnavi Shivhare"}
                              </td>
                              <td className="py-2.5 px-4 border-r border-border whitespace-nowrap dark:border-neutral-800">
                                <span className={`font-semibold ${log.billingType === "BILLABLE" ? "text-info dark:text-sky-400" : "text-warning dark:text-amber-400"}`}>
                                  {log.billingType}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 border-r border-border whitespace-nowrap dark:border-neutral-800">
                                {log.approvalStatus === "Approved" ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold">
                                    Approved
                                  </span>
                                ) : log.approvalStatus === "Rejected" ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2 py-0.5 text-[11px] font-bold">
                                    Rejected
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[11px] font-bold">
                                    Pending Approval
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-muted-foreground dark:text-neutral-300">
                                {log.remarks || "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === "CHECKLIST" && (
                <div className="text-xs text-muted-foreground py-4 text-center dark:text-neutral-400">
                  Checklist items for {activeTask.code}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* New Time Log Modal */}
      <NewTimeLogModal
        isOpen={isTimeLogModalOpen}
        onClose={() => setIsTimeLogModalOpen(false)}
        initialProject={project?.name || projectId}
        projectId={projectId}
        projectName={project?.name}
        initialTaskCode={activeTask.code}
        assignedUsers={activeTask.owner ? [activeTask.owner] : undefined}
        onLogAdded={refreshTaskTimeLogs}
      />

      {/* Add Subtask Drawer */}
      <AddSubtaskDrawer
        isOpen={isAddSubtaskDrawerOpen}
        onClose={() => setIsAddSubtaskDrawerOpen(false)}
        parentTaskCode={activeTask.code}
        nextSubtaskNumber={subtasks.length + 1}
        onAddSubtask={(newSubtask) => {
          createSubtaskAction(activeTask.id, {
            title: newSubtask.title,
            status: newSubtask.status,
            ownerName: newSubtask.ownerName,
            startDate: newSubtask.startDate,
            dueDate: newSubtask.dueDate,
            completed: newSubtask.completed,
          })
            .then((created) => {
              if (!created) return;
              const updatedSubtasks = [...subtasks, created];
              setSubtasks(updatedSubtasks);
              const updatedTask = { ...activeTask, subtasks: updatedSubtasks };
              setTasks((prev) => prev.map((t) => (t.id === activeTask.id ? updatedTask : t)));
            })
            .catch((err) => console.error("Failed to save subtask:", err));
        }}
      />

      {/* Timer Stopped Modal */}
      <TimerStoppedModal
        isOpen={isStoppedModalOpen}
        onClose={() => setIsStoppedModalOpen(false)}
        elapsedSeconds={stoppedSeconds}
        taskTitle={activeTask.title}
        taskCode={activeTask.code}
        initialStartTime={activeTimerStartTime}
        onSaveLog={handleTimerLogSaved}
      />
    </div>
  );
}
