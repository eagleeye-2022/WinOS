"use client";

import React, { useState, useEffect } from "react";
import { Search, X, UserPlus, Check, Loader2, Shield, Users } from "lucide-react";
import {
  getAvailableUsersForProjectAction,
  addProjectMembersAction,
  ProjectMemberUser,
} from "../../actions/project-actions";

interface AddProjectUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onUsersAdded: () => void;
}

export function AddProjectUsersModal({
  isOpen,
  onClose,
  projectId,
  onUsersAdded,
}: AddProjectUsersModalProps) {
  const [availableUsers, setAvailableUsers] = useState<ProjectMemberUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && projectId) {
      async function loadAvailableUsers() {
        setIsLoading(true);
        setError(null);
        setSelectedUserIds([]);
        setSearchQuery("");
        try {
          const users = await getAvailableUsersForProjectAction(projectId);
          setAvailableUsers(users);
        } catch (err) {
          console.error("Failed to load available users:", err);
          setError("Failed to fetch available users.");
        } finally {
          setIsLoading(false);
        }
      }
      loadAvailableUsers();
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const filteredUsers = availableUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const isAllSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((u) => selectedUserIds.includes(u.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map((u) => u.id));
    }
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleAddSelected = async () => {
    if (selectedUserIds.length === 0) return;
    setIsSubmitting(true);
    try {
      await addProjectMembersAction(projectId, selectedUserIds);
      onUsersAdded();
      onClose();
    } catch (err) {
      console.error("Failed to assign users to project:", err);
      setError("Failed to assign selected users.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-emerald-600 text-white",
      "bg-blue-600 text-white",
      "bg-purple-600 text-white",
      "bg-amber-600 text-white",
      "bg-rose-600 text-white",
      "bg-indigo-600 text-white",
      "bg-teal-600 text-white",
      "bg-cyan-600 text-white",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl border bg-card text-card-foreground shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Add Users to Project</h2>
              <p className="text-xs text-muted-foreground">
                Select one or multiple team members to assign to this project.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {/* Search bar & Select All */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Search users by name, email, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {filteredUsers.length > 0 && (
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-xs font-semibold text-primary hover:underline whitespace-nowrap px-2 py-1"
              >
                {isAllSelected ? "Deselect All" : "Select All"}
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
              {error}
            </div>
          )}

          {/* User List */}
          {isLoading ? (
            <div className="flex h-48 flex-col items-center justify-center space-y-2">
              <Loader2 size={24} className="animate-spin text-primary" />
              <p className="text-xs text-muted-foreground font-medium">Loading available users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center p-6 text-center text-muted-foreground border border-dashed rounded-lg">
              <Users size={32} className="mb-2 text-muted-foreground/50" />
              <p className="text-sm font-semibold text-foreground">No available users found</p>
              <p className="text-xs mt-1">
                {searchQuery
                  ? "No team members match your search criteria."
                  : "All active team members are already assigned to this project."}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {filteredUsers.map((user) => {
                const isSelected = selectedUserIds.includes(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => handleToggleUser(user.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 dark:bg-primary/10"
                        : "border-border hover:border-muted-foreground/30 hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(
                          user.name
                        )}`}
                      >
                        {getInitials(user.name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{user.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                            {user.department || "Team"}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{user.email}</p>
                      </div>
                    </div>

                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/40 bg-background"
                      }`}
                    >
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t px-6 py-4 bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground">
            {selectedUserIds.length} user{selectedUserIds.length === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-input bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddSelected}
              disabled={selectedUserIds.length === 0 || isSubmitting}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Assigning...</span>
                </>
              ) : (
                <>
                  <UserPlus size={14} />
                  <span>Add Selected ({selectedUserIds.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
