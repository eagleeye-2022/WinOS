"use client";

import React, { useState } from "react";
import {
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  Calendar,
  Paperclip,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Maximize2,
  AlignLeft,
  Loader2,
} from "lucide-react";
import { DEFAULT_PROJECT_PHASES } from "../../data/mock-projects";
import { Project, ProjectPhase } from "../../types";

interface AddProjectDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProject: (project: Project) => void;
}

export function AddProjectDrawer({
  isOpen,
  onClose,
  onAddProject,
}: AddProjectDrawerProps) {
  const [projectName, setProjectName] = useState("WinOS");
  const [phases, setPhases] = useState<ProjectPhase[]>(DEFAULT_PROJECT_PHASES);

  // Accordion Section Toggle States
  const [phasesOpen, setPhasesOpen] = useState(true);
  const [taskInfoOpen, setTaskInfoOpen] = useState(true);
  const [descriptionOpen, setDescriptionOpen] = useState(true);

  // Task Information Form Fields
  const [associatedTeam, setAssociatedTeam] = useState("");
  const [owner, setOwner] = useState("Dhruv Patidar");
  const [workHours, setWorkHours] = useState("0:00");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<string>("None");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [reminder, setReminder] = useState("");
  const [billingType, setBillingType] = useState("Fixed Rate");

  // Description & Attachments
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  // New Phase Add Inline State
  const [showAddPhaseModal, setShowAddPhaseModal] = useState(false);
  const [newPhaseCode, setNewPhaseCode] = useState("");
  const [newPhaseName, setNewPhaseName] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAddNewPhase = () => {
    if (!newPhaseName.trim()) return;
    const code = newPhaseCode.trim() || `${phases.length + 1}.1`;
    const newPhase: ProjectPhase = {
      id: `p-${Date.now()}`,
      code,
      name: newPhaseName,
      isCompleted: false,
    };
    setPhases((prev) => [...prev, newPhase]);
    setNewPhaseCode("");
    setNewPhaseName("");
    setShowAddPhaseModal(false);
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setAttachments((prev) => [...prev, ...filesArray]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setIsSubmitting(true);

    const initials = owner
      ? owner
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : "DP";

    const newProject: Project = {
      id: `EEDP-${Math.floor(10 + Math.random() * 90)}`,
      name: projectName,
      progressPercent: 0,
      owner: {
        id: `u-${Date.now()}`,
        name: owner || "Dhruv Patidar",
        initials: initials || "DP",
        avatarColor: "bg-amber-500 text-white",
      },
      status: "ACTIVE",
      totalHours: workHours ? `${workHours} h` : "00:00 h",
      billableHours: billingType === "Non Billable" ? "00:00 h" : "00:00 h",
      nonBillableHours: billingType === "Non Billable" ? workHours || "01:00 h" : "00:00 h",
      startDate: startDate || new Date().toLocaleDateString("en-GB"),
      deadline: dueDate || "01/01/2027",
      completedTasksCount: 0,
      totalTasksCount: 0,
      taskProgressPercent: 0,
      completedPhasesCount: 0,
      totalPhasesCount: phases.length,
      phases: phases,
      description,
      tags,
      createdAt: new Date().toISOString().split("T")[0],
    };

    onAddProject(newProject);
    onClose();
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-overlay backdrop-blur-xs transition-opacity duration-200">
      <div className="relative flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-foreground">Add New Project</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Body Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm"
        >
          {/* Project Name Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Project Name <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <select
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
              >
                <option value="WinOS">WinOS</option>
                <option value="Untitled OMS">Untitled OMS</option>
                <option value="Super Kids Academy">Super Kids Academy</option>
                <option value="Pamas">Pamas</option>
                <option value="SAP : Safari Adventure Park">
                  SAP : Safari Adventure Park
                </option>
                <option value="TCBI">TCBI</option>
                <option value="EED Website">EED Website</option>
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
            </div>
          </div>

          {/* Collapsible: Phases Section */}
          <div className="rounded-md border border-border bg-card">
            <button
              type="button"
              onClick={() => setPhasesOpen(!phasesOpen)}
              className="flex w-full items-center justify-between px-4 py-3 text-xs font-bold text-foreground hover:bg-accent/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChevronDown
                  size={16}
                  className={`text-muted-foreground transition-transform duration-200 ${
                    phasesOpen ? "" : "-rotate-90"
                  }`}
                />
                <span>Phases</span>
              </div>
            </button>

            {phasesOpen && (
              <div className="border-t px-4 py-3 space-y-2">
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {phases.map((phase) => (
                    <div
                      key={phase.id}
                      className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2 text-xs text-foreground hover:border-primary/40 transition-colors cursor-pointer"
                    >
                      <span className="font-medium">
                        {phase.code} {phase.name}
                      </span>
                      <ChevronDown size={14} className="text-muted-foreground" />
                    </div>
                  ))}
                </div>

                {/* Add New Phase Button */}
                <button
                  type="button"
                  onClick={() => setShowAddPhaseModal(true)}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-info/30 bg-info/10 py-2.5 text-xs font-semibold text-info hover:bg-info/15 transition-colors"
                >
                  Add New Phase <Plus size={15} />
                </button>

                {/* Inline Add Phase Input if toggled */}
                {showAddPhaseModal && (
                  <div className="mt-3 rounded-md border p-3 bg-muted/30 space-y-2.5 animate-in fade-in duration-150">
                    <div className="text-xs font-semibold text-foreground">
                      Create Custom Phase
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Code (e.g. 8.1)"
                        value={newPhaseCode}
                        onChange={(e) => setNewPhaseCode(e.target.value)}
                        className="w-24 rounded border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <input
                        type="text"
                        placeholder="Phase Name..."
                        value={newPhaseName}
                        onChange={(e) => setNewPhaseName(e.target.value)}
                        className="flex-1 rounded border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddPhaseModal(false)}
                        className="rounded px-2.5 py-1 text-xs border bg-background hover:bg-accent"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddNewPhase}
                        className="rounded px-3 py-1 text-xs bg-primary text-primary-foreground font-medium hover:bg-primary/90"
                      >
                        Save Phase
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Collapsible: Task Information */}
          <div className="rounded-md border border-border bg-card">
            <button
              type="button"
              onClick={() => setTaskInfoOpen(!taskInfoOpen)}
              className="flex w-full items-center justify-between px-4 py-3 text-xs font-bold text-foreground hover:bg-accent/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChevronDown
                  size={16}
                  className={`text-muted-foreground transition-transform duration-200 ${
                    taskInfoOpen ? "" : "-rotate-90"
                  }`}
                />
                <span>Task Information</span>
              </div>
            </button>

            {taskInfoOpen && (
              <div className="border-t px-4 py-4 space-y-4">
                {/* Associated Team */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">
                    Associated Team
                  </label>
                  <select
                    value={associatedTeam}
                    onChange={(e) => setAssociatedTeam(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select Team</option>
                    <option value="Engineering">Engineering Team</option>
                    <option value="Design">UI/UX Design Team</option>
                    <option value="Marketing">Marketing Team</option>
                    <option value="QA">QA & Testing Team</option>
                  </select>
                </div>

                {/* Owner */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">
                    Owner
                  </label>
                  <select
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Dhruv Patidar">Dhruv Patidar</option>
                    <option value="Vaishnavi Shivhare">Vaishnavi Shivhare</option>
                    <option value="Alex Johnson">Alex Johnson</option>
                    <option value="Sarah Miller">Sarah Miller</option>
                  </select>
                </div>

                {/* Work Hours */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">
                    Work Hours
                  </label>
                  <input
                    type="text"
                    value={workHours}
                    onChange={(e) => setWorkHours(e.target.value)}
                    placeholder="0:00"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Start Date & Due Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">
                      Start Date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary pr-8"
                      />
                      <Calendar
                        size={14}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground font-medium">
                        Due Date
                      </label>
                      <button
                        type="button"
                        className="text-[10px] text-primary hover:underline"
                      >
                        Enter Duration
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary pr-8"
                      />
                      <Calendar
                        size={14}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Priority */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="None">None</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                {/* Tags */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:text-destructive"
                        >
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
                    placeholder="Enter a tag name and press Enter"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Reminder & Billing Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">
                      Reminder
                    </label>
                    <input
                      type="date"
                      value={reminder}
                      onChange={(e) => setReminder(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">
                      Billing type
                    </label>
                    <select
                      value={billingType}
                      onChange={(e) => setBillingType(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="Fixed Rate">Fixed Rate</option>
                      <option value="Hourly Rate">Hourly Rate</option>
                      <option value="Non Billable">Non Billable</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Collapsible: Add Description */}
          <div className="rounded-md border border-border bg-card">
            <button
              type="button"
              onClick={() => setDescriptionOpen(!descriptionOpen)}
              className="flex w-full items-center justify-between px-4 py-3 text-xs font-bold text-foreground hover:bg-accent/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChevronDown
                  size={16}
                  className={`text-muted-foreground transition-transform duration-200 ${
                    descriptionOpen ? "" : "-rotate-90"
                  }`}
                />
                <span>Add Description</span>
              </div>
            </button>

            {descriptionOpen && (
              <div className="border-t p-4 space-y-3">
                {/* Rich Editor Toolbar */}
                <div className="flex flex-wrap items-center gap-1.5 border-b pb-2 text-muted-foreground">
                  <button
                    type="button"
                    className="p-1 hover:bg-accent rounded text-foreground font-bold"
                    title="Bold"
                  >
                    <Bold size={14} />
                  </button>
                  <button
                    type="button"
                    className="p-1 hover:bg-accent rounded text-foreground italic"
                    title="Italic"
                  >
                    <Italic size={14} />
                  </button>
                  <button
                    type="button"
                    className="p-1 hover:bg-accent rounded text-foreground underline"
                    title="Underline"
                  >
                    <Underline size={14} />
                  </button>
                  <button
                    type="button"
                    className="p-1 hover:bg-accent rounded text-foreground line-through"
                    title="Strikethrough"
                  >
                    <Strikethrough size={14} />
                  </button>
                  <div className="h-4 w-px bg-border mx-1" />
                  <span className="text-xs font-semibold text-foreground">Puvi</span>
                  <span className="text-xs text-muted-foreground">13</span>
                  <div className="h-3 w-3 rounded bg-black dark:bg-white border cursor-pointer" />
                  <AlignLeft size={14} className="cursor-pointer hover:text-foreground" />
                  <Maximize2 size={14} className="ml-auto cursor-pointer hover:text-foreground" />
                </div>

                {/* Description Textarea */}
                <textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter detailed project scope, specifications, or notes here..."
                  className="w-full resize-y bg-background text-xs text-foreground p-2 outline-none border rounded-md focus:ring-1 focus:ring-primary"
                />

                {/* Drop Files Zone */}
                <div className="relative border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <Paperclip size={20} className="text-muted-foreground" />
                    <p className="text-xs text-muted-foreground font-medium">
                      Drop files or add attachments here...
                    </p>
                    <span className="text-[10px] text-muted-foreground/70">
                      Maximum 30 files
                    </span>
                  </div>
                </div>

                {/* Uploaded Files List */}
                {attachments.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-foreground">
                      Attachments ({attachments.length}):
                    </span>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {attachments.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs bg-muted px-2.5 py-1 rounded"
                        >
                          <span className="truncate max-w-xs">{file.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setAttachments(attachments.filter((_, i) => i !== idx))
                            }
                            className="text-destructive hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form Actions Footer */}
          <div className="flex items-center justify-start gap-3 pt-3 pb-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-md bg-primary px-6 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              Add
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
