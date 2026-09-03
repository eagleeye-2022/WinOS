"use client";

import React, { useState } from "react";
import { X, Shield, CheckCircle2, Loader2 } from "lucide-react";
import { ProjectUser } from "../../types";

interface ClientPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientUser: ProjectUser | null;
}

const DEFAULT_CLIENT_PERMISSIONS = [
  { key: "PROJECT_OVERVIEW", label: "Project Overview", enabled: true },
  { key: "TASKS", label: "Tasks", enabled: true },
  { key: "TASK_DETAILS", label: "Task Details", enabled: true },
  { key: "TASK_COMMENTS", label: "Task Comments", enabled: true },
  { key: "DOCUMENTS", label: "Documents", enabled: true },
  { key: "DISCUSSIONS", label: "Discussions", enabled: true },
  { key: "PROJECT_CHAT", label: "Project Chat", enabled: true },
  { key: "MILESTONES", label: "Milestones & Phases", enabled: true },
  { key: "TIME_LOGS", label: "Time Logs", enabled: false },
  { key: "REPORTS", label: "Reports", enabled: false },
  { key: "PROJECT_SETTINGS", label: "Project Settings", enabled: false },
  { key: "USER_MANAGEMENT", label: "User Management", enabled: false },
  { key: "INTERNAL_NOTES", label: "Internal Notes", enabled: false },
];

export function ClientPermissionsModal({
  isOpen,
  onClose,
  clientUser,
}: ClientPermissionsModalProps) {
  const [permissions, setPermissions] = useState(DEFAULT_CLIENT_PERMISSIONS);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  if (!isOpen || !clientUser) return null;

  const handleToggle = (key: string) => {
    setPermissions((prev) =>
      prev.map((p) => (p.key === key ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Simulate saving client permissions to backend
      await new Promise((resolve) => setTimeout(resolve, 600));
      setSavedMsg(true);
      setTimeout(() => {
        setSavedMsg(false);
        onClose();
      }, 1200);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg rounded-xl bg-background border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <Shield size={18} className="text-primary" />
            <div>
              <h2 className="text-base font-bold text-foreground">
                Client Permissions: {clientUser.name}
              </h2>
              <p className="text-xs text-muted-foreground">{clientUser.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {savedMsg && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={16} />
            <span>Permissions saved successfully.</span>
          </div>
        )}

        {/* Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3 text-xs">
          <p className="text-muted-foreground pb-1">
            Toggle module access for this client. Changes take effect immediately.
          </p>

          <div className="grid grid-cols-1 gap-2">
            {permissions.map((perm) => (
              <label
                key={perm.key}
                className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card hover:bg-accent/30 cursor-pointer transition-colors"
              >
                <div>
                  <span className="font-medium text-foreground block">
                    {perm.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {perm.enabled ? "Enabled for client" : "Disabled"}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={perm.enabled}
                  onChange={() => handleToggle(perm.key)}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4 bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-input bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving && <Loader2 size={13} className="animate-spin" />}
            Save Permissions
          </button>
        </div>
      </div>
    </div>
  );
}
