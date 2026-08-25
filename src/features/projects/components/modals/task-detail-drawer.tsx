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
import { TaskItem, TaskRemark, TaskStatus, TaskSubtask } from "../../types";
import { PickTemplateModal } from "./pick-template-modal";
import { NewTimeLogModal } from "./new-time-log-modal";
import { TaskMultiOwnerSelect } from "../task-multi-owner-select";
import { getOwnersAndTeamsAction } from "../../actions/project-actions";

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
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
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
    task?.owners && task.owners.length > 0
      ? task.owners
      : task?.owner && task.owner !== "Unassigned"
      ? task.owner.split(",").map((s) => s.trim()).filter(Boolean)
      : []
  );
  const [ownersList, setOwnersList] = useState<
    { id: string; name: string; email: string }[]
  >([]);

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
  const [duration, setDuration] = useState(task?.duration || "2 days/hrs");
  const [completionPercentage, setCompletionPercentage] = useState(
    task?.completionPercentage || 0
  );
  const [recurrence, setRecurrence] = useState("None");
  const [priority, setPriority] = useState(task?.priority || "None");
  const [tagsInput, setTagsInput] = useState("");
  const [tags, setTags] = useState<string[]>(task?.tags || []);
  const [reminder, setReminder] = useState("None");
  const [billingType, setBillingType] = useState(task?.billingType || "None");

  // Checklist Tab States (Matching Image 3 & 4)
  const [unsectionedChecklist, setUnsectionedChecklist] = useState([
    { id: "c1", label: "T&C", checked: false },
    { id: "c2", label: "Refund Policy", checked: false },
    { id: "c3", label: "Common/All Pages: Blog", checked: false },
    { id: "c4", label: "Common/All Pages: Location", checked: false },
  ]);

  const [sopSchedules, setSopSchedules] = useState([
    {
      id: "sop-1",
      title: "Keyword Research Outcome SOP",
      count: 11,
      expanded: false,
      items: [
        { id: "kr-1", label: "Verify primary keywords", checked: false },
        { id: "kr-2", label: "Check competitor search volume", checked: false },
      ],
    },
    {
      id: "sop-2",
      title: "Ui UX After Dev Testing SOP",
      count: 21,
      expanded: true,
      items: [
        { id: "ux-1", label: "No spelling/grammar mistakes", checked: false },
        { id: "ux-2", label: "Design matches approved Figma/layout", checked: false },
        { id: "ux-3", label: "Fonts, colors, spacing correct", checked: false },
        { id: "ux-4", label: "All sections aligned properly", checked: false },
        { id: "ux-5", label: "Mobile responsiveness verified", checked: false },
      ],
    },
  ]);

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

  const handleToggleCheckitem = (id: string) => {
    setUnsectionedChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const handleToggleSopItem = (sopId: string, itemId: string) => {
    setSopSchedules((prev) =>
      prev.map((sop) => {
        if (sop.id !== sopId) return sop;
        return {
          ...sop,
          items: sop.items.map((it) =>
            it.id === itemId ? { ...it, checked: !it.checked } : it
          ),
        };
      })
    );
  };

  const handleSelectAllSop = (sopId: string, currentVal: boolean) => {
    setSopSchedules((prev) =>
      prev.map((sop) => {
        if (sop.id !== sopId) return sop;
        return {
          ...sop,
          items: sop.items.map((it) => ({ ...it, checked: !currentVal })),
        };
      })
    );
  };

  const handleAddTemplate = (titles: string[]) => {
    const newSops = titles.map((title, idx) => ({
      id: `sop-new-${Date.now()}-${idx}`,
      title,
      count: 10,
      expanded: true,
      items: [
        { id: `ni-1-${idx}`, label: "Initial setup step", checked: false },
        { id: `ni-2-${idx}`, label: "Quality verification check", checked: false },
      ],
    }));
    setSopSchedules((prev) => [...prev, ...newSops]);
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
                  <span className="font-mono text-[10px] font-bold text-muted-foreground">
                    {item.code}
                  </span>
                  <span className="rounded-full bg-info/10 px-2 py-0.5 text-[9px] font-bold text-info">
                    {item.status.toUpperCase()}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-foreground leading-tight">
                  {item.title}
                </h4>

                <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground">
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
                <span className="rounded-md bg-sky-500 px-2 py-0.5 text-[11px] font-bold text-white">
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
                  className="flex items-center gap-1 rounded bg-[#0088ff] px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-[#0077ee] transition-colors mr-1"
                >
                  <Plus size={13} />
                  <span>Time Log</span>
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
                  <span className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold">
                    DP
                  </span>
                  <span>By Dhruv Patidar</span>
                </div>

                <div className="flex items-center gap-2">
                  <span title="Comments"><MessageSquare size={13} className="cursor-pointer hover:text-foreground" /></span>
                  <span title="Attachments"><Paperclip size={13} className="cursor-pointer hover:text-foreground" /></span>
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
                  onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                  className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
                STATUS
              </span>
            </div>

            {/* Owner Section matching user reference screenshot */}
            <div className="rounded-lg border p-3 bg-card shadow-2xs">
              <TaskMultiOwnerSelect
                label="Owner"
                selectedOwners={selectedOwners}
                onChangeOwners={(newOwners) => {
                  setSelectedOwners(newOwners);
                  const primaryOwner = newOwners.length > 0 ? newOwners.join(", ") : "Unassigned";
                  onUpdateTask({ ...task, owners: newOwners, owner: primaryOwner });
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

            {/* Checklist Tab (Matching Images 3 & 4) */}
            {activeTab === "CHECKLIST" && (
              <div className="space-y-4 pt-2">
                {/* Header Action Button */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <ChevronDown size={16} className="text-muted-foreground" />
                    <span>Checklist</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsTemplateModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-2xs hover:bg-primary/90 transition-colors"
                  >
                    Add Template
                  </button>
                </div>

                {/* Unsectioned Items List (Matching Image 3 & 4) */}
                <div className="border-t border-b py-3 space-y-2.5 pl-2">
                  {unsectionedChecklist.map((item) => (
                    <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => handleToggleCheckitem(item.id)}
                        className="rounded border-input text-primary h-4 w-4"
                      />
                      <span className={`text-xs ${item.checked ? "line-through text-muted-foreground" : "text-foreground font-medium"}`}>
                        {item.label}
                      </span>
                    </label>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      const label = prompt("Enter new checklist item label:");
                      if (label && label.trim()) {
                        setUnsectionedChecklist([
                          ...unsectionedChecklist,
                          { id: `c-${Date.now()}`, label: label.trim(), checked: false },
                        ]);
                      }
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-info pt-1 hover:underline"
                  >
                    + Create Item
                  </button>
                </div>

                {/* SOP Accordions (Matching Image 3 & 4) */}
                <div className="space-y-3 pt-1">
                  {sopSchedules.map((sop) => (
                    <div key={sop.id} className="rounded-lg border bg-card overflow-hidden shadow-2xs">
                      {/* Accordion Header */}
                      <button
                        type="button"
                        onClick={() =>
                          setSopSchedules((prev) =>
                            prev.map((s) =>
                              s.id === sop.id ? { ...s, expanded: !s.expanded } : s
                            )
                          )
                        }
                        className="flex w-full items-center justify-between p-3 bg-muted/20 hover:bg-accent/40 font-bold text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            size={16}
                            className={`text-muted-foreground transition-transform ${
                              sop.expanded ? "" : "-rotate-90"
                            }`}
                          />
                          <span>{sop.title}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {sop.count}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Progress bar */}
                          <div className="w-24 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${
                                  (sop.items.filter((i) => i.checked).length /
                                    (sop.items.length || 1)) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                          <MoreHorizontal size={14} className="text-muted-foreground" />
                        </div>
                      </button>

                      {/* Accordion Content */}
                      {sop.expanded && (
                        <div className="p-4 border-t space-y-3 bg-background">
                          {/* Select All */}
                          <label className="flex items-center gap-3 font-bold text-info cursor-pointer border-b pb-2">
                            <input
                              type="checkbox"
                              checked={sop.items.length > 0 && sop.items.every((i) => i.checked)}
                              onChange={() =>
                                handleSelectAllSop(
                                  sop.id,
                                  sop.items.every((i) => i.checked)
                                )
                              }
                              className="rounded border-input text-primary h-4 w-4"
                            />
                            <span>Select All</span>
                          </label>

                          {/* Item List */}
                          <div className="space-y-2.5 pl-1">
                            {sop.items.map((it) => (
                              <label key={it.id} className="flex items-center gap-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={it.checked}
                                  onChange={() => handleToggleSopItem(sop.id, it.id)}
                                  className="rounded border-input text-primary h-4 w-4"
                                />
                                <span className={`text-xs ${it.checked ? "line-through text-muted-foreground" : "text-foreground font-medium"}`}>
                                  {it.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Save All Progress Button */}
                <div className="flex justify-end pt-3">
                  <button
                    type="button"
                    onClick={() => alert("Checklist progress saved successfully!")}
                    className="rounded-md bg-primary px-6 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 shadow-2xs transition-colors"
                  >
                    Save All Progress
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pick Template Modal */}
      <PickTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onAddTemplates={handleAddTemplate}
      />

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
