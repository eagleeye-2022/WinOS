"use client";

import React, { useState } from "react";
import {
  X,
  Mail,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shield,
  Briefcase,
  ChevronDown,
} from "lucide-react";
import { Project } from "../../types";
import { createClientInvitationAction } from "@/features/projects/actions/client-invitation-actions";

interface InviteClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onSuccess?: () => void;
}

const DEFAULT_PERMISSIONS = [
  { key: "PROJECT_OVERVIEW", label: "Project Overview", enabled: true },
  { key: "TASKS", label: "Tasks", enabled: true },
  { key: "TASK_DETAILS", label: "Task Details", enabled: true },
  { key: "TASK_COMMENTS", label: "Task Comments", enabled: true },
  { key: "DOCUMENTS", label: "Documents", enabled: true },
  { key: "DISCUSSIONS", label: "Discussions", enabled: true },
  { key: "PROJECT_CHAT", label: "Project Chat", enabled: true },
  { key: "MILESTONES", label: "Milestones / Phases", enabled: true },
  { key: "TIME_LOGS", label: "Time Logs", enabled: false },
  { key: "REPORTS", label: "Reports", enabled: false },
];

export function InviteClientModal({
  isOpen,
  onClose,
  projects,
  onSuccess,
}: InviteClientModalProps) {
  const [clientName, setClientName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [projectSearch, setProjectSearch] = useState("");
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [showPermissions, setShowPermissions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleProject = (id: string) => {
    if (selectedProjectIds.includes(id)) {
      setSelectedProjectIds(selectedProjectIds.filter((pId) => pId !== id));
    } else {
      setSelectedProjectIds([...selectedProjectIds, id]);
    }
  };

  const handleSelectAllProjects = () => {
    if (selectedProjectIds.length === filteredProjects.length) {
      setSelectedProjectIds([]);
    } else {
      setSelectedProjectIds(filteredProjects.map((p) => p.id));
    }
  };

  const handleTogglePermission = (key: string) => {
    setPermissions((prev) =>
      prev.map((p) => (p.key === key ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg("Email address is required.");
      return;
    }

    if (selectedProjectIds.length === 0) {
      setErrorMsg("Please select at least one project for the client.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createClientInvitationAction({
        email: email.trim(),
        clientName: clientName.trim() || undefined,
        projectIds: selectedProjectIds,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to send client invitation.");
      } else {
        setSuccessMsg(`Invitation successfully sent to ${email.trim()}!`);
        setTimeout(() => {
          setClientName("");
          setEmail("");
          setSelectedProjectIds([]);
          setSuccessMsg(null);
          onSuccess?.();
          onClose();
        }, 1500);
      }
    } catch (err) {
      setErrorMsg("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.id.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-overlay backdrop-blur-xs transition-opacity duration-200">
      <div className="relative flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-300 border-l border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Briefcase size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Invite Client</h2>
              <p className="text-xs text-muted-foreground">
                Grant external client access to specific projects and features
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-sm"
        >
          {/* Section 1: Client Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              1. Client Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Client Name
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. John Smith"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Email Address <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@company.com"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground pr-9 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Mail
                    size={15}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Project Access Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                2. Project Access ({selectedProjectIds.length} Selected)
              </h3>
              {filteredProjects.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllProjects}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  {selectedProjectIds.length === filteredProjects.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              )}
            </div>

            {/* Project Search Box */}
            <div className="relative">
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Search authorized projects..."
                className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
            </div>

            {/* Project List */}
            <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-card p-2 space-y-1">
              {filteredProjects.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No projects found.
                </p>
              ) : (
                filteredProjects.map((project) => {
                  const isChecked = selectedProjectIds.includes(project.id);
                  return (
                    <label
                      key={project.id}
                      className={`flex items-center justify-between gap-3 p-2 rounded cursor-pointer text-xs transition-colors ${
                        isChecked
                          ? "bg-primary/10 border border-primary/20 text-foreground"
                          : "hover:bg-accent/40 text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleProject(project.id)}
                          className="rounded border-input text-primary focus:ring-primary h-4 w-4 shrink-0"
                        />
                        <span className="font-medium truncate">{project.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                        {project.id}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Section 3: Client Permissions Configuration */}
          <div className="rounded-md border border-border bg-card">
            <button
              type="button"
              onClick={() => setShowPermissions(!showPermissions)}
              className="flex w-full items-center justify-between px-4 py-3 text-xs font-bold text-foreground hover:bg-accent/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-primary" />
                <span>Configure Client Feature Permissions</span>
              </div>
              <ChevronDown
                size={16}
                className={`text-muted-foreground transition-transform duration-200 ${
                  showPermissions ? "" : "-rotate-90"
                }`}
              />
            </button>

            {showPermissions && (
              <div className="border-t p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-background">
                {permissions.map((perm) => (
                  <label
                    key={perm.key}
                    className="flex items-center justify-between p-2 rounded border border-border/50 text-xs hover:bg-accent/20 cursor-pointer"
                  >
                    <span className="font-medium text-foreground">{perm.label}</span>
                    <input
                      type="checkbox"
                      checked={perm.enabled}
                      onChange={() => handleTogglePermission(perm.key)}
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
              >
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                Send Client Invitation
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-input bg-background px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
