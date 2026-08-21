"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  X,
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
} from "lucide-react";
import { TaskItem, TaskStatus } from "../../types";
import { TimerWidget } from "../timer-widget";
import { NewTimeLogModal } from "../modals/new-time-log-modal";
import { getTasksAction, updateTaskAction } from "../../actions/project-actions";

interface SingleTaskWorkspaceViewProps {
  projectId: string;
  taskId: string;
}

export function SingleTaskWorkspaceView({
  projectId,
  taskId,
}: SingleTaskWorkspaceViewProps) {
  const router = useRouter();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTimeLogModalOpen, setIsTimeLogModalOpen] = useState(false);

  // Selected phase filter for left sidebar task list
  const [selectedPhase, setSelectedPhase] = useState("ALL");

  useEffect(() => {
    async function loadTasks() {
      setIsLoading(true);
      try {
        const fetchedTasks = await getTasksAction(projectId);
        setTasks(fetchedTasks);
      } catch (err) {
        console.error("Failed to load tasks for single task view:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadTasks();
  }, [projectId]);

  const leftTaskItems = tasks;

  // Current active task matching route taskId parameter
  const activeTask =
    leftTaskItems.find(
      (t) =>
        t.code.toLowerCase() === taskId.toLowerCase() ||
        t.id.toLowerCase() === taskId.toLowerCase()
    ) ||
    leftTaskItems[0] || {
      id: taskId,
      code: taskId,
      title: "Task " + taskId,
      phaseCode: "1.1",
      phaseName: "General",
      status: "Open",
      authorName: "System",
      owner: "Unassigned",
      description: "",
      completionPercentage: 0,
      subtasks: [],
      remarks: [],
      activities: [],
    };

  // Active Task Form & Section States
  const [taskStatus, setTaskStatus] = useState<TaskStatus>(
    activeTask.status || "Open"
  );
  const [descriptionOpen, setDescriptionOpen] = useState(true);
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
  >([
    {
      id: "c-1",
      author: "Dhruv Patidar",
      text: "Initial kickoff meeting aligned with the client.",
      time: "2 hours ago",
    },
  ]);

  // Dynamically compute list of unique phases from all available tasks
  const availablePhases = Array.from(
    new Set(
      leftTaskItems.map(
        (t) => `${t.phaseCode || "1.1"} ${t.phaseName || "Client On Boarding"}`
      )
    )
  );

  // Auto-sync phase selection & status to match the active task when navigating to a new taskId
  const [prevTaskId, setPrevTaskId] = useState(taskId);
  if (taskId !== prevTaskId) {
    setPrevTaskId(taskId);
    setTaskStatus(activeTask.status || "Open");
    setSelectedPhase(
      `${activeTask.phaseCode || "1.1"} ${activeTask.phaseName || "Client On Boarding"}`
    );
  }

  const handleSelectTaskCard = (code: string) => {
    router.push(`/projects/${projectId}/tasks/${code}`);
  };

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    setCommentsList((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        author: "Dhruv Patidar",
        text: commentText,
        time: "Just now",
      },
    ]);
    setCommentText("");
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
              <span>By Dhruv Patidar</span>
              <span>|</span>
              <span className="flex items-center gap-1 text-foreground font-medium dark:text-neutral-300">
                <Folder size={12} className="text-info dark:text-sky-400" /> WinOS
              </span>
              <span>💬 📎</span>
              <span>|</span>

              {/* Embedded Live Timer Widget */}
              <TimerWidget />

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
          {/* Status Field */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-neutral-400">
              STATUS
            </span>
            <div className="relative inline-block">
              <select
                value={taskStatus}
                onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
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
                Description <Plus size={13} className="text-info dark:text-sky-400" />
              </span>
            </button>
            {descriptionOpen && (
              <div className="px-4 pb-4 pt-1 text-xs text-muted-foreground border-t border-border/60 font-mono dark:text-neutral-400 dark:border-neutral-800/60">
                {activeTask.description ? (
                  <a
                    href={activeTask.description}
                    target="_blank"
                    rel="noreferrer"
                    className="text-info underline break-all hover:text-info/80 dark:text-sky-400 dark:hover:text-sky-300"
                  >
                    {activeTask.description}
                  </a>
                ) : (
                  "NO DESCRIPTION AVAILABLE"
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
                <div>
                  <span className="text-muted-foreground block text-[10px] dark:text-neutral-400">Owner</span>
                  <span className="font-medium text-foreground dark:text-neutral-100">{activeTask.owner || "Unassigned"}</span>
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
                { key: "LOG_HOURS", label: "Log Hours (09:47)" },
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
                <div className="text-xs text-muted-foreground py-4 text-center dark:text-neutral-400">
                  Subtasks list for {activeTask.code}
                </div>
              )}

              {activeTab === "LOG_HOURS" && (
                <div className="text-xs text-muted-foreground py-4 text-center dark:text-neutral-400">
                  Total Tracked Hours: 09:47 hrs
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
        initialProject="WinOS"
        initialTaskCode={activeTask.code}
      />
    </div>
  );
}
