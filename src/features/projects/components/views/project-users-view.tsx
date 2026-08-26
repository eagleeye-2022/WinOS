"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Search,
  Trash2,
  Shield,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Mail,
  Building2,
  UserCheck,
} from "lucide-react";
import {
  getProjectMembersAction,
  removeProjectMemberAction,
  ProjectMemberUser,
} from "../../actions/project-actions";
import { AddProjectUsersModal } from "../modals/add-project-users-modal";

interface ProjectUsersViewProps {
  projectId: string;
  projectName?: string;
  onMembersCountChange?: (count: number) => void;
}

export function ProjectUsersView({
  projectId,
  projectName,
  onMembersCountChange,
}: ProjectUsersViewProps) {
  const [members, setMembers] = useState<ProjectMemberUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const fetchMembers = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProjectMembersAction(projectId);
      setMembers(data);
      if (onMembersCountChange) {
        onMembersCountChange(data.length);
      }
    } catch (err) {
      console.error("Failed to load project members:", err);
      setError("Failed to load assigned project users.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, onMembersCountChange]);

  useEffect(() => {
    if (projectId) {
      React.startTransition(() => {
        fetchMembers();
      });
    }
  }, [projectId, fetchMembers]);

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to remove ${userName} from this project?`)) {
      return;
    }
    setRemovingUserId(userId);
    try {
      await removeProjectMemberAction(projectId, userId);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
      if (onMembersCountChange) {
        onMembersCountChange(members.length - 1);
      }
    } catch (err) {
      console.error("Failed to remove project user:", err);
      alert("Failed to remove user from project.");
    } finally {
      setRemovingUserId(null);
    }
  };

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.department && m.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.title && m.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
    <div className="flex flex-col h-full bg-background text-foreground overflow-y-auto p-6 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Project Users</h2>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary font-mono">
              {members.length} Assigned
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage users and team members assigned to {projectName ? `"${projectName}"` : "this project"}. Only assigned users can be assigned to tasks in this project.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search input */}
          <div className="relative w-64">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Search assigned users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Add User Button */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
          >
            <UserPlus size={15} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex h-64 flex-col items-center justify-center space-y-3">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-medium">Fetching assigned project users...</p>
        </div>
      ) : error ? (
        <div className="flex h-48 flex-col items-center justify-center space-y-2 text-destructive border border-dashed rounded-xl p-6">
          <AlertCircle size={28} />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center p-8 text-center border border-dashed rounded-xl space-y-3 bg-muted/10">
          <div className="p-3 rounded-full bg-primary/10 text-primary">
            <Users size={32} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {searchQuery ? "No matching users found" : "No users assigned yet"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              {searchQuery
                ? `No assigned team members match "${searchQuery}".`
                : "Assign team members to this project so they can view the project and work on assigned tasks."}
            </p>
          </div>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs mt-2"
            >
              <UserPlus size={15} />
              <span>Add User to Project</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="group relative flex flex-col justify-between rounded-xl border bg-card p-4 shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold shadow-xs ${getAvatarColor(
                      member.name
                    )}`}
                  >
                    {getInitials(member.name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-foreground leading-tight">
                        {member.name}
                      </h4>
                      {member.isOwner && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono">
                          Owner
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Mail size={12} className="text-muted-foreground/70" />
                      <span>{member.email}</span>
                    </p>
                  </div>
                </div>

                {!member.isOwner && (
                  <button
                    type="button"
                    onClick={() => handleRemoveUser(member.id, member.name)}
                    disabled={removingUserId === member.id}
                    title="Remove user from project"
                    className="opacity-80 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    {removingUserId === member.id ? (
                      <Loader2 size={16} className="animate-spin text-destructive" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                )}
              </div>

              {/* Details Footer */}
              <div className="mt-4 pt-3 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1 font-medium text-foreground/80">
                  <Building2 size={12} className="text-muted-foreground" />
                  {member.department || "Development"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <UserCheck size={11} />
                  Assigned
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Users Modal */}
      <AddProjectUsersModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        projectId={projectId}
        onUsersAdded={fetchMembers}
      />
    </div>
  );
}
