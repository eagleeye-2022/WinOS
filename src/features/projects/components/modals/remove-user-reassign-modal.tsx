"use client";

import React, { useState } from "react";
import { AlertTriangle, UserCheck, Loader2, X } from "lucide-react";
import { ProjectMemberUser } from "../../actions/project-actions";

interface RemoveUserReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToRemove: ProjectMemberUser | null;
  otherMembers: ProjectMemberUser[];
  onConfirmRemove: (reassignToUserId?: string) => Promise<void>;
}

export function RemoveUserReassignModal({
  isOpen,
  onClose,
  userToRemove,
  otherMembers,
  onConfirmRemove,
}: RemoveUserReassignModalProps) {
  const [reassignToUserId, setReassignToUserId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !userToRemove) return null;

  const openTasks = userToRemove.openTasksCount || 0;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirmRemove(reassignToUserId || undefined);
      onClose();
    } catch (err) {
      console.error("Failed to remove user:", err);
      alert("An error occurred while removing user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-background border rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-muted/20">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={20} />
            <h3 className="text-base font-bold text-foreground">
              Remove User from Project
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <p className="text-foreground">
            Are you sure you want to remove{" "}
            <span className="font-bold text-primary">{userToRemove.name}</span> ({userToRemove.email}) from this project?
          </p>

          {openTasks > 0 ? (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                <span>Active Tasks Notice ({openTasks} Open Tasks)</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                This user currently has <span className="font-bold">{openTasks} open task(s)</span> assigned to them in this project. You can choose another team member to automatically receive these tasks.
              </p>

              <div className="pt-2">
                <label className="block text-[11px] font-bold text-foreground mb-1">
                  Reassign Open Tasks To:
                </label>
                <select
                  value={reassignToUserId}
                  onChange={(e) => setReassignToUserId(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background p-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Do Not Reassign (Unassign Tasks) --</option>
                  {otherMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.projectRole || "Team Member"})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-[11px]">
              This user has no open assigned tasks. Removing them will revoke their access to this project.
            </p>
          )}
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Removing...</span>
              </>
            ) : (
              <>
                <UserCheck size={14} />
                <span>Confirm Removal</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
