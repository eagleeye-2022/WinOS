"use client";

import React, { useState } from "react";
import { X, Calendar, Loader2, Info } from "lucide-react";
import { TaskSubtask, TaskStatus } from "../../types";

interface AddSubtaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSubtask: (subtask: TaskSubtask) => void;
  parentTaskCode: string;
  nextSubtaskNumber: number;
}

export function AddSubtaskDrawer({
  isOpen,
  onClose,
  onAddSubtask,
  parentTaskCode,
  nextSubtaskNumber,
}: AddSubtaskDrawerProps) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState(() =>
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [status, setStatus] = useState<TaskStatus>("Open");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "--";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);

    const newSubtask: TaskSubtask = {
      id: `st-${Date.now()}`,
      code: `${parentTaskCode}.${nextSubtaskNumber}`,
      title: title.trim(),
      status,
      ownerName: undefined, // Owner is dynamically inherited from parent task
      startDate: formatDateDisplay(startDate),
      dueDate: formatDateDisplay(dueDate),
      completed: status === "Closed",
    };

    onAddSubtask(newSubtask);
    onClose();
    setTitle("");
    setDescription("");
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-200">
      <div className="relative flex h-full w-full max-w-xl flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-300 font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground dark:text-neutral-100">Add Subtask</h2>
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono font-semibold text-muted-foreground">
              {parentTaskCode}.{nextSubtaskNumber}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs"
        >
          {/* Information Notice: Owner inherited automatically */}
          <div className="flex items-center gap-2.5 rounded-lg border border-info/30 bg-info/10 px-3.5 py-2.5 text-foreground font-medium">
            <Info size={16} className="text-info shrink-0" />
            <span>
              Subtask owners are automatically inherited from parent task <strong className="font-mono">{parentTaskCode}</strong>.
            </span>
          </div>

          {/* Subtask Title */}
          <div className="space-y-1.5">
            <label className="font-semibold text-muted-foreground flex items-center justify-between">
              <span>Task Name (Subtask Title) <span className="text-destructive">*</span></span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Perform QA cross-browser test"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              autoFocus
            />
          </div>

          {/* Status & Parent Task Code Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground">
                Parent Task Code
              </label>
              <input
                type="text"
                disabled
                value={parentTaskCode}
                className="w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-xs text-muted-foreground font-mono font-bold"
              />
            </div>
          </div>

          {/* Start Date & Due Date Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground flex items-center gap-1.5">
                <Calendar size={13} className="text-primary" />
                <span>Start Date</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground flex items-center gap-1.5">
                <Calendar size={13} className="text-primary" />
                <span>Due Date (End Date)</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              />
            </div>
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
              placeholder="Subtask details or specifications..."
              className="w-full rounded-md border border-input bg-background p-3 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary resize-y font-sans"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-start gap-3 pt-5 border-t border-border dark:border-neutral-800">
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex items-center gap-1.5 rounded-md bg-[#0088ff] px-6 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0077ee] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              <span>Add Subtask</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-input bg-background px-6 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
