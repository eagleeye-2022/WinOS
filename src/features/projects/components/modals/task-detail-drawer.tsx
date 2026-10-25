"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ChevronDown,
  MessageSquare,
  Paperclip,
  History,
  Clock,
  Calendar,
  MoreHorizontal,
  UserPlus,
  Maximize2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Filter,
  Sparkles,
  ExternalLink,
  Plus,
  Trash2,
  User,
  SlidersHorizontal,
  ThumbsUp,
  Edit2,
  Maximize,
  AlertCircle,
  Ban,
  Info,
  Check,
  ClipboardList,
} from "lucide-react";
import { TaskItem, TaskRemark, TaskStatus, TaskSubtask, PROJECT_TASK_STATUSES } from "../../types";
import { TaskChecklistTab } from "@/features/sop-checklists/components/task-checklist-tab";
import { NewTimeLogModal } from "./new-time-log-modal";
import { TaskMultiOwnerSelect } from "../task-multi-owner-select";
import {
  getOwnersAndTeamsAction,
  getCurrentUserContextAction,
  getMyProjectUserProjectIdsAction,
} from "../../actions/project-actions";

interface TaskDetailDrawerProps {
  task: TaskItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTask: (updatedTask: TaskItem) => void;
}

export function TaskDetailDrawer({
  task,
  isOpen,
  onClose,
  onUpdateTask,
}: TaskDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<
    "REMARKS" | "SUBTASKS" | "TRACKED_HOURS" | "TIMELINE" | "CHECKLIST"
  >("CHECKLIST");

  const [descriptionOpen, setDescriptionOpen] = useState(true);
  const [taskInfoOpen, setTaskInfoOpen] = useState(true);
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [isTimeLogModalOpen, setIsTimeLogModalOpen] = useState(false);

  // Left split-pane task list
  const [selectedTaskCode, setSelectedTaskCode] = useState("WI1-T11");
  const leftTaskItems = [
    {
      code: "WI1-T11",
      title: "V1 Keyword Research by UI/UX",
      status: "Open",
      warning: true,
    },
    {
      code: "WI1-T12",
      title: "Competitor Analysis",
      status: "Open",
      warning: true,
    },
    {
      code: "WI1-T13",
      title: "Stakeholder Interview & Surveys",
      status: "Open",
      warning: true,
    },
  ];

  // Form Fields
  const [status, setStatus] = useState<TaskStatus>(task?.status || "Open");
  const [associatedTeam, setAssociatedTeam] = useState(
    task?.associatedTeam || "--"
  );
  const [selectedOwners, setSelectedOwners] = useState<string[]>(
    (task?.owners && task.owners.length > 0
      ? task.owners
      : task?.owner && task.owner !== "Unassigned"
      ? task.owner.split(",").map((s) => s.trim()).filter(Boolean)
      : []
    ).filter((o) => o && o.trim().toLowerCase() !== "unassigned")
  );
  const [ownersList, setOwnersList] = useState<
    { id: string; name: string; email: string }[]
  >([]);

  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: string;
  } | null>(null);

  useEffect(() => {
    getCurrentUserContextAction().then((u) => {
      if (u) setCurrentUser(u);
    });
  }, []);

  // Projects the current user is a project user of — any project user can edit and (re)assign
  // every task in that project, not only its owner.
  const [myProjectIds, setMyProjectIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    getMyProjectUserProjectIdsAction()
      .then((ids) => setMyProjectIds(new Set(ids)))
      .catch(() => {});
  }, []);

  /** "Can act on this task": owner, ADMIN, or a user of the task's project. */
  const isOwner = React.useMemo(() => {
    if (!currentUser || !task) return false;
    if (currentUser.role === "ADMIN") return true;
    if (task.projectId && myProjectIds.has(task.projectId)) return true;

    const uId = currentUser.id.toLowerCase();
    const uName = currentUser.name.trim().toLowerCase();
    const uEmail = currentUser.email.trim().toLowerCase();

    if (task.ownerIds && task.ownerIds.includes(currentUser.id)) return true;
    if (task.ownerId && task.ownerId.toLowerCase() === uId) return true;

    const ownerNames =
      task.owners && task.owners.length > 0
        ? task.owners
        : task.owner && task.owner !== "Unassigned"
        ? task.owner.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    const isUnowned = ownerNames.length === 0 && !task.ownerId && (!task.ownerIds || task.ownerIds.length === 0);
    if (isUnowned) return true;

    return ownerNames.some((raw) => {
      const o = raw.trim().toLowerCase();
      if (!o || o === "unassigned") return false;
      return (
        o === uId ||
        o === uName ||
        o === uEmail ||
        (uName.length > 2 && o.includes(uName)) ||
        (o.length > 2 && uName.includes(o))
      );
    });
  }, [currentUser, task, myProjectIds]);

  useEffect(() => {
    const pCode = (task as { projectId?: string } | null)?.projectId || (task?.code ? task.code.split("-T")[0] : undefined);
    getOwnersAndTeamsAction(pCode)
      .then((res) => {
        if (res.owners) setOwnersList(res.owners);
      })
      .catch((err) => console.error("Failed to load owners for detail drawer:", err));
  }, [task?.id, task?.code]);
  const [workHours, setWorkHours] = useState("00:00");
  const [startDate, setStartDate] = useState(task?.startDate || "--");
  const [dueDate, setDueDate] = useState(task?.dueDate || "--");
  const [duration, setDuration] = useState(task?.duration || "--");
  const [completionPercentage, setCompletionPercentage] = useState(
    task?.completionPercentage || 0
  );
  const [recurrence, setRecurrence] = useState("None");
  const [priority, setPriority] = useState(task?.priority || "None");
  const [tagsInput, setTagsInput] = useState("");
  const [tags, setTags] = useState<string[]>(task?.tags || []);
  const [reminder, setReminder] = useState("None");
  const [billingType, setBillingType] = useState(task?.billingType || "None");

  const [newRemarkText, setNewRemarkText] = useState("");
  const [remarks, setRemarks] = useState<TaskRemark[]>(
    task?.remarks && task.remarks.length > 0
      ? task.remarks
      : [
          {
            id: "rem-default",
            authorName: "Vaishnavi Shivhare",
            authorInitials: "VS",
            authorAvatarColor: "bg-primary text-primary-foreground",
            content:
              "1. brand consistency is like showing up the same way, every time. It's not just about looking the same; it's about offering the same level of reliability, value, and experience.",
            createdAt: "28/10/2025 05:59 PM",
          },
        ]
  );

  const [likedRemarkIds, setLikedRemarkIds] = useState<string[]>([]);
  const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const [subtasks, setSubtasks] = useState<TaskSubtask[]>(
    task?.subtasks && task.subtasks.length > 0
      ? task.subtasks
      : [
          {
            id: "st-1",
            code: "WI1-T11",
            title: "V1 Keyword Research by UI/UX",
            status: "Open",
            ownerName: "Unassigned",
            startDate: "--",
            dueDate: "--",
            completed: false,
            hasLink: false,
          },
          {
            id: "st-2",
            code: "WI1-T14",
            title: "Keyword Research Document Creation",
            status: "Open",
            ownerName: "Unassigned",
            startDate: "--",
            dueDate: "--",
            completed: false,
            hasLink: true,
          },
          {
            id: "st-3",
            code: "WI1-T15",
            title: "User Research",
            status: "Open",
            ownerName: "Unassigned",
            startDate: "--",
            dueDate: "--",
            completed: false,
            hasLink: true,
          },
          {
            id: "st-4",
            code: "WI1-T49",
            title: "Follow Keyword Research SOP",
            status: "Open",
            ownerName: "Unassigned",
            startDate: "--",
            dueDate: "--",
            completed: false,
            hasLink: true,
          },
        ]
  );

  if (!isOpen || !task) return null;

  const handleStatusChange = (newStatus: TaskStatus) => {
    setStatus(newStatus);
    const updated: TaskItem = { ...task, status: newStatus };
    onUpdateTask(updated);
  };

  const handleRemoveOwner = () => {
    setSelectedOwners([]);
    onUpdateTask({ ...task, owner: "", owners: [] });
  };

  const handleAddRemark = () => {
    if (!newRemarkText.trim()) return;
    const newRemark: TaskRemark = {
      id: `rem-${Date.now()}`,
      authorName: "Vaishnavi Shivhare",
      authorInitials: "VS",
      authorAvatarColor: "bg-primary text-primary-foreground",
      content: newRemarkText,
      createdAt: new Date().toLocaleString("en-GB"),
    };
    const updatedRemarks = [newRemark, ...remarks];
    setRemarks(updatedRemarks);
    setNewRemarkText("");
    onUpdateTask({ ...task, remarks: updatedRemarks });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-overlay backdrop-blur-xs transition-opacity duration-200">
      <div className="relative flex h-full w-full max-w-5xl bg-background shadow-2xl animate-in slide-in-from-right duration-300 overflow-hidden">
        {/* Left Split-Pane Task Selector */}
        <div className="w-64 border-r border-border bg-muted/10 flex flex-col shrink-0 select-none p-3 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b">
            <span className="text-xs font-bold text-foreground">
              2.1 UX Research &amp; Disc...
            </span>
            <ChevronDown size={14} className="text-muted-foreground cursor-pointer" />
          </div>

          <div className="space-y-2 overflow-y-auto flex-1">
            {leftTaskItems.map((item) => (
              <div
                key={item.code}
                onClick={() => setSelectedTaskCode(item.code)}
                className={`rounded-lg border p-3 cursor-pointer transition-all space-y-1.5 ${
                  selectedTaskCode === item.code
                    ? "border-primary bg-background shadow-xs ring-1 ring-primary/40"
                    : "border-border bg-background/60 hover:border-primary/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-muted-foreground">
                    {item.code}
                  </span>
                  <span className="rounded-full bg-info/10 px-2 py-0.5 text-xs font-bold text-info">
                    {item.status.toUpperCase()}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-foreground leading-tight">
                  {item.title}
                </h4>

                <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                  <span>Unassigned</span>
                  {item.warning && (
                    <span className="text-destructive font-bold">!</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Main Task Detail Section */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Drawer Header */}
          <div className="border-b px-6 py-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-sky-500 px-2 py-0.5 text-xs font-bold text-white">
                  Task
                </span>
                <span className="font-mono text-xs text-muted-foreground font-semibold">
                  {task.code}
                </span>
              </div>

              <div className="flex items-center gap-2 text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setIsTimeLogModalOpen(true)}
                  className="flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors mr-1"
                >
                  <Plus size={13} />
                  <span>Effort Log</span>
                </button>
                <button
                  type="button"
                  className="p-1 hover:bg-accent rounded hover:text-foreground"
                  title="Options"
                >
                  <MoreHorizontal size={16} />
                </button>
                <button
                  type="button"
                  className="p-1 hover:bg-accent rounded hover:text-foreground"
                  title="Assign Member"
                >
                  <UserPlus size={16} />
                </button>
                <button
                  type="button"
                  className="p-1 hover:bg-accent rounded hover:text-foreground"
                  title="Maximize"
                >
                  <Maximize2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 hover:bg-accent rounded hover:text-foreground"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Title & Author Info */}
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                {task.title}
              </h2>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                    DP
                  </span>
                  <span>By Dhruv Patidar</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* <span title="Comments"><MessageSquare size={13} className="cursor-pointer hover:text-foreground" /></span>
                  <span title="Attachments"><Paperclip size={13} className="cursor-pointer hover:text-foreground" /></span> */}
                  <span title="History"><History size={13} className="cursor-pointer hover:text-foreground" /></span>
                  <span title="Work Hours"><Clock size={13} className="cursor-pointer hover:text-foreground" /></span>
                  <span title="Due Date"><Calendar size={13} className="cursor-pointer hover:text-foreground" /></span>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-xs">
            {/* Status Section */}
            <div className="rounded-lg border p-3 bg-card flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <select
                  value={status}
                  onChange={(e) => {
                    if (!isOwner) return;
                    const newStatus = e.target.value as TaskStatus;
                    setStatus(newStatus);
                    if (task) onUpdateTask({ ...task, status: newStatus });
                  }}
                  disabled={!isOwner}
                  title={isOwner ? "Change status" : `Only the task owner (${task?.owner || "Unassigned"}) can change the status`}
                >
                  {PROJECT_TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  {!PROJECT_TASK_STATUSES.includes(status as any) && (
                    <option value={status}>{status}</option>
                  )}
                </select>
              </div>
              <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
                STATUS
              </span>
            </div>

            {/* Owner Section matching user reference screenshot */}
            <div className="rounded-lg border p-3 bg-card shadow-2xs">
              <TaskMultiOwnerSelect
                label="Owner"
                selectedOwners={selectedOwners}
                disabled={!isOwner}
                disabledReason={!isOwner ? `Only the task owner (${task?.owner || "Unassigned"}) can change the owner` : undefined}
                onChangeOwners={(newOwners) => {
                  if (!isOwner) return;
                  const cleanOwners = newOwners.filter((o) => o && o.trim().toLowerCase() !== "unassigned");
                  setSelectedOwners(cleanOwners);
                  const primaryOwner = cleanOwners.length > 0 ? cleanOwners.join(", ") : "Unassigned";
                  if (task) onUpdateTask({ ...task, owners: cleanOwners, owner: primaryOwner });
                }}
                ownersList={ownersList}
              />
            </div>

            {/* Description Section */}
            <div className="rounded-lg border bg-card shadow-2xs">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <button
                  type="button"
                  onClick={() => setDescriptionOpen(!descriptionOpen)}
                  className="flex items-center gap-2 font-bold text-foreground hover:bg-accent/40"
                >
                  <ChevronDown
                    size={16}
                    className={`text-muted-foreground transition-transform ${
                      descriptionOpen ? "" : "-rotate-90"
                    }`}
                  />
                  <span>Description</span>
                  <Plus size={14} className="text-info ml-1" />
                </button>
              </div>

              {descriptionOpen && (
                <div className="p-4 text-foreground leading-relaxed break-all space-y-2">
                  <a
                    href="https://www.figma.com/design/Vm2CJsnQueANsM8TOXAl6H/WinOS---Web-Design?node-id=1-7&t=7EKtZ6Eb1SFxcRt-1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info hover:underline font-medium block"
                  >
                    https://www.figma.com/design/Vm2CJsnQueANsM8TOXAl6H/WinOS---Web-Design?node-id=1-7&amp;t=7EKtZ6Eb1SFxcRt-1
                  </a>
                </div>
              )}
            </div>

            {/* Sub-Tabs Navigation */}
            <div className="border-b pt-2 flex gap-6 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("REMARKS")}
                className={`pb-2.5 transition-colors ${
                  activeTab === "REMARKS"
                    ? "text-info border-b-2 border-info font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Remarks
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("SUBTASKS")}
                className={`pb-2.5 transition-colors ${
                  activeTab === "SUBTASKS"
                    ? "text-info border-b-2 border-info font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Subtasks (3)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("TRACKED_HOURS")}
                className={`pb-2.5 transition-colors ${
                  activeTab === "TRACKED_HOURS"
                    ? "text-info border-b-2 border-info font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Tracked Hours
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("TIMELINE")}
                className={`pb-2.5 transition-colors ${
                  activeTab === "TIMELINE"
                    ? "text-info border-b-2 border-info font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Status Timeline
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("CHECKLIST")}
                className={`pb-2.5 transition-colors ${
                  activeTab === "CHECKLIST"
                    ? "text-info border-b-2 border-info font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Checklist
              </button>
            </div>

            {activeTab === "CHECKLIST" && (
              <div className="pt-2">
                <TaskChecklistTab taskId={task.id} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Time Log Modal */}
      <NewTimeLogModal
        isOpen={isTimeLogModalOpen}
        onClose={() => setIsTimeLogModalOpen(false)}
        initialProject="EED Core"
        initialTaskCode={task.code}
      />
    </div>
  );
}
