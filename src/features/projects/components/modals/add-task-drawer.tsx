"use client";

import React, { useState, useEffect } from "react";
import { X, ChevronDown, Calendar, Tag as TagIcon, Loader2 } from "lucide-react";
import { TaskItem, TaskStatus } from "../../types";
import { getOwnersAndTeamsAction } from "../../actions/project-actions";

interface AddTaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (task: TaskItem) => void;
  availablePhases: { code: string; name: string }[];
}

const FALLBACK_PHASE = { code: "1.1", name: "GENERAL" };

export function AddTaskDrawer({
  isOpen,
  onClose,
  onAddTask,
  availablePhases,
}: AddTaskDrawerProps) {
  const [title, setTitle] = useState("");
  const [phaseCode, setPhaseCode] = useState(availablePhases[0]?.code || FALLBACK_PHASE.code);
  const [status, setStatus] = useState<TaskStatus>("Open");
  const [owner, setOwner] = useState("Unassigned");
  const [associatedTeam, setAssociatedTeam] = useState("Engineering");
  const [priority, setPriority] = useState("None");
  const [duration, setDuration] = useState("2 days/hrs");
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ownersList, setOwnersList] = useState<{ id: string; name: string; email: string }[]>([]);
  const [teamsList, setTeamsList] = useState<string[]>([]);

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await getOwnersAndTeamsAction();
        if (res.owners && res.owners.length > 0) {
          setOwnersList(res.owners);
          if (!owner || owner === "Unassigned") {
            setOwner(res.owners[0].name);
          }
        }
        if (res.teams && res.teams.length > 0) {
          setTeamsList(res.teams);
          if (!associatedTeam) {
            setAssociatedTeam(res.teams[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load user options:", err);
      }
    }
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput("");
    }
  };

  const removeTag = (t: string) => {
    setTags(tags.filter((tag) => tag !== t));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);

    const selectedPhase =
      availablePhases.find((p) => p.code === phaseCode) || FALLBACK_PHASE;

    let derivedDeptAlias = "digitalproducts@";
    if (selectedPhase.code === "3.1" || selectedPhase.code === "3.2") derivedDeptAlias = "design@";
    else if (selectedPhase.code === "4.1") derivedDeptAlias = "dev@";
    else if (selectedPhase.code === "5.1") derivedDeptAlias = "qa@";

    const taskCode = `WI1-T${Math.floor(40 + Math.random() * 50)}`;

    const newTask: TaskItem = {
      id: `t-${Date.now()}`,
      code: taskCode,
      title,
      phaseCode: selectedPhase.code,
      phaseName: selectedPhase.name,
      status,
      authorName: "Dhruv Patidar",
      associatedTeam,
      departmentAlias: derivedDeptAlias,
      owner,
      workHours: "00:00",
      startDate: new Date().toLocaleDateString("en-GB"),
      dueDate: "01/01/2027",
      duration,
      completionPercentage: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      priority: priority as any,
      tags,
      description,
      subtasks: [],
      remarks: [],
      activities: [
        {
          id: `act-${Date.now()}`,
          date: new Date().toLocaleDateString("en-GB"),
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          userName: "Dhruv Patidar",
          userInitials: "DP",
          actionText: "created task",
        },
      ],
      assignees: [
        { id: "u-dp", name: owner, initials: "DP", avatarColor: "bg-amber-500 text-white" },
      ],
    };

    onAddTask(newTask);
    onClose();
    setTitle("");
    setDescription("");
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-overlay backdrop-blur-xs transition-opacity duration-200">
      <div className="relative flex h-full w-full max-w-xl flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-foreground">Add New Task</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs"
        >
          {/* Title */}
          <div className="space-y-1.5">
            <label className="font-semibold text-muted-foreground">
              Task Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design wireframes for dashboard"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Phase */}
          <div className="space-y-1.5">
            <label className="font-semibold text-muted-foreground">
              Phase / Workflow Section
            </label>
            <div className="relative">
              <select
                value={phaseCode}
                onChange={(e) => setPhaseCode(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
              >
                {availablePhases.length === 0 ? (
                  <option value={FALLBACK_PHASE.code}>{FALLBACK_PHASE.name}</option>
                ) : (
                  availablePhases.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
            </div>
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="None">None</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Owner & Team */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground">
                Task Owner
              </label>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
              >
                <option value="Unassigned">Unassigned</option>
                {ownersList.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground">
                Associated Team
              </label>
              <select
                value={associatedTeam}
                onChange={(e) => setAssociatedTeam(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
              >
                <option value="">Select Team</option>
                {teamsList.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="font-semibold text-muted-foreground">
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs"
                >
                  {t}
                  <button type="button" onClick={() => removeTag(t)}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Type tag and press Enter"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-semibold text-muted-foreground">
              Description
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task details or specifications..."
              className="w-full rounded-md border border-input bg-background p-3 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary resize-y"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-start gap-3 pt-4 border-t">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-md bg-primary px-6 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              Create Task
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-input bg-background px-6 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
