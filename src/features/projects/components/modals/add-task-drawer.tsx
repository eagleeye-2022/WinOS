"use client";

import React, { useState } from "react";
import { X, ChevronDown, Calendar, Tag as TagIcon } from "lucide-react";
import { TaskItem, TaskStatus } from "../../types";

interface AddTaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (task: TaskItem) => void;
}

export function AddTaskDrawer({
  isOpen,
  onClose,
  onAddTask,
}: AddTaskDrawerProps) {
  const [title, setTitle] = useState("");
  const [phaseName, setPhaseName] = useState("IDEATION & CONCEPTUALIZATION");
  const [status, setStatus] = useState<TaskStatus>("Open");
  const [owner, setOwner] = useState("Dhruv Patidar");
  const [associatedTeam, setAssociatedTeam] = useState("Engineering");
  const [priority, setPriority] = useState("None");
  const [duration, setDuration] = useState("2 days/hrs");
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

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

    const taskCode = `WI1-T${Math.floor(40 + Math.random() * 50)}`;

    const newTask: TaskItem = {
      id: `t-${Date.now()}`,
      code: taskCode,
      title,
      phaseCode: "2.2",
      phaseName,
      status,
      authorName: "Dhruv Patidar",
      associatedTeam,
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
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity duration-200">
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
                value={phaseName}
                onChange={(e) => setPhaseName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
              >
                <option value="IDEATION & CONCEPTUALIZATION">
                  IDEATION & CONCEPTUALIZATION
                </option>
                <option value="UI/UX DESIGNING">UI/UX DESIGNING</option>
                <option value="GRAPHIC DESIGNING">GRAPHIC DESIGNING</option>
                <option value="CONTENT WRITING">CONTENT WRITING</option>
                <option value="DEVELOPMENT">DEVELOPMENT</option>
                <option value="TESTING">TESTING</option>
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
                Owner
              </label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground">
                Associated Team
              </label>
              <input
                type="text"
                value={associatedTeam}
                onChange={(e) => setAssociatedTeam(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
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
              className="rounded-md bg-blue-600 px-6 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs"
            >
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
