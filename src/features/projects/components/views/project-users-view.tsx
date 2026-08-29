"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Search,
  Trash2,
  Loader2,
  AlertCircle,
  Mail,
  Building2,
  UserCheck,
  LayoutGrid,
  Table,
  Download,
  Filter,
  DollarSign,
  Clock,
  CheckSquare,
  Edit2,
  Eye,
  Check,
  Shield,
  Briefcase,
} from "lucide-react";
import {
  getProjectMembersAction,
  updateProjectMemberDetailsAction,
  removeProjectMemberWithReassignmentAction,
  ProjectMemberUser,
} from "../../actions/project-actions";
import { AddProjectUsersModal } from "../modals/add-project-users-modal";
import { UserDetailDrawer } from "../modals/user-detail-drawer";
import { RemoveUserReassignModal } from "../modals/remove-user-reassign-modal";

interface ProjectUsersViewProps {
  projectId: string;
  projectName?: string;
  onMembersCountChange?: (count: number) => void;
}

const PROJECT_ROLE_OPTIONS = [
  "Project Manager",
  "Lead Developer",
  "Senior Developer",
  "UI/UX Designer",
  "QA Specialist",
  "DevOps Engineer",
  "Team Member",
  "Client Representative",
];

export function ProjectUsersView({
  projectId,
  projectName,
  onMembersCountChange,
}: ProjectUsersViewProps) {
  const [members, setMembers] = useState<ProjectMemberUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"GRID" | "TABLE">("GRID");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDrawerUserId, setSelectedDrawerUserId] = useState<string | null>(null);
  const [userToRemove, setUserToRemove] = useState<ProjectMemberUser | null>(null);

  // Inline edit state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [editRate, setEditRate] = useState<number>(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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

  const handleConfirmRemoveUser = async (reassignToUserId?: string) => {
    if (!userToRemove) return;
    try {
      await removeProjectMemberWithReassignmentAction(
        projectId,
        userToRemove.id,
        reassignToUserId
      );
      setMembers((prev) => prev.filter((m) => m.id !== userToRemove.id));
      if (onMembersCountChange) {
        onMembersCountChange(members.length - 1);
      }
    } catch (err) {
      console.error("Failed to remove member:", err);
      alert("Failed to remove user from project.");
    }
  };

  const startEditUser = (member: ProjectMemberUser) => {
    setEditingUserId(member.id);
    setEditRole(member.projectRole || "Team Member");
    setEditRate(member.hourlyRate || 0);
  };

  const saveEditUser = async (userId: string) => {
    setIsSavingEdit(true);
    try {
      await updateProjectMemberDetailsAction(projectId, userId, {
        projectRole: editRole,
        hourlyRate: editRate,
      });
      setMembers((prev) =>
        prev.map((m) =>
          m.id === userId
            ? { ...m, projectRole: editRole, hourlyRate: editRate }
            : m
        )
      );
      setEditingUserId(null);
    } catch (err) {
      console.error("Failed to update user details:", err);
      alert("Failed to update user details.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Name",
      "Email",
      "Project Role",
      "System Role",
      "Department",
      "Open Tasks",
      "Completed Tasks",
      "Total Hours Logged",
      "Hourly Rate ($)",
      "Status",
    ];
    const rows = filteredMembers.map((m) => [
      `"${m.name}"`,
      `"${m.email}"`,
      `"${m.projectRole || "Team Member"}"`,
      `"${m.role}"`,
      `"${m.department || "Development"}"`,
      m.openTasksCount || 0,
      m.completedTasksCount || 0,
      `"${m.totalLoggedHours || "00:00 h"}"`,
      m.hourlyRate || 0,
      `"${m.status || "ACTIVE"}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `project_users_${projectName ? projectName.replace(/\s+/g, "_") : projectId}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.department &&
        m.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.projectRole &&
        m.projectRole.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.title && m.title.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole =
      roleFilter === "ALL" ||
      (m.projectRole || "Team Member").toUpperCase() === roleFilter.toUpperCase();

    return matchesSearch && matchesRole;
  });

  // Calculate Summary KPI Stats
  const totalMembers = members.length;
  const activeMembers = members.filter((m) => m.status !== "INACTIVE").length;
  const totalOpenTasks = members.reduce((acc, m) => acc + (m.openTasksCount || 0), 0);
  const totalMinutesLogged = members.reduce(
    (acc, m) => acc + (m.totalLoggedMinutes || 0),
    0
  );
  const totalHoursLoggedFormatted = `${Math.floor(totalMinutesLogged / 60)}:${String(
    totalMinutesLogged % 60
  ).padStart(2, "0")} h`;

  const avgHourlyRate =
    members.length > 0
      ? (
          members.reduce((acc, m) => acc + (m.hourlyRate || 0), 0) / members.length
        ).toFixed(1)
      : "0";

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
      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Total Users
            </span>
            <div className="text-xl font-extrabold text-foreground mt-0.5 font-mono">
              {totalMembers}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Users size={18} />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Active Members
            </span>
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
              {activeMembers}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <UserCheck size={18} />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Open Tasks Assigned
            </span>
            <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-0.5 font-mono">
              {totalOpenTasks}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <CheckSquare size={18} />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Total Logged Hours
            </span>
            <div className="text-xl font-extrabold text-purple-600 dark:text-purple-400 mt-0.5 font-mono">
              {totalHoursLoggedFormatted}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Clock size={18} />
          </div>
        </div>
      </div>

      {/* Top Controls Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Project Users</h2>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary font-mono">
              {filteredMembers.length} Showing
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage users, project roles, hourly rates, and task allocations for {projectName ? `"${projectName}"` : "this project"}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search input */}
          <div className="relative w-56">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Role Filter Dropdown */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Project Roles</option>
              {PROJECT_ROLE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden p-0.5 bg-muted/30">
            <button
              type="button"
              onClick={() => setViewMode("GRID")}
              className={`p-1.5 rounded transition-colors ${
                viewMode === "GRID"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("TABLE")}
              className={`p-1.5 rounded transition-colors ${
                viewMode === "TABLE"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Table View"
            >
              <Table size={15} />
            </button>
          </div>

          {/* Export CSV */}
          <button
            type="button"
            onClick={exportToCSV}
            className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
            title="Export Users CSV"
          >
            <Download size={14} />
            <span className="hidden md:inline">Export</span>
          </button>

          {/* Add User Button */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
          >
            <UserPlus size={14} />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex h-64 flex-col items-center justify-center space-y-3">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-medium">Fetching project team users...</p>
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
              {searchQuery || roleFilter !== "ALL"
                ? "No matching project users found"
                : "No team members assigned yet"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              {searchQuery || roleFilter !== "ALL"
                ? "Try adjusting your search query or role filter."
                : "Assign team members to this project so they can work on tasks and log hours."}
            </p>
          </div>
          {!searchQuery && roleFilter === "ALL" && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs mt-2"
            >
              <UserPlus size={14} />
              <span>Add User to Project</span>
            </button>
          )}
        </div>
      ) : viewMode === "GRID" ? (
        /* GRID CARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="group relative flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold shadow-xs cursor-pointer ${getAvatarColor(
                        member.name
                      )}`}
                      onClick={() => setSelectedDrawerUserId(member.id)}
                    >
                      {getInitials(member.name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4
                          onClick={() => setSelectedDrawerUserId(member.id)}
                          className="text-sm font-bold text-foreground leading-tight hover:text-primary cursor-pointer transition-colors"
                        >
                          {member.name}
                        </h4>
                        {member.isOwner && (
                          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono">
                            Owner
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
                        <Mail size={11} className="text-muted-foreground/70" />
                        <span>{member.email}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedDrawerUserId(member.id)}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Inspect User Details"
                    >
                      <Eye size={15} />
                    </button>
                    {!member.isOwner && (
                      <button
                        type="button"
                        onClick={() => setUserToRemove(member)}
                        title="Remove user from project"
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Role & Rate Section */}
                {editingUserId === member.id ? (
                  <div className="mt-3 p-2.5 rounded-lg border bg-muted/30 space-y-2 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground">Project Role</label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="w-full rounded border border-input bg-background p-1 text-xs text-foreground mt-0.5"
                      >
                        {PROJECT_ROLE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground">Hourly Rate ($/hr)</label>
                      <input
                        type="number"
                        value={editRate}
                        onChange={(e) => setEditRate(parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-input bg-background p-1 text-xs text-foreground mt-0.5 font-mono"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingUserId(null)}
                        className="px-2 py-1 rounded border text-[11px]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEditUser(member.id)}
                        disabled={isSavingEdit}
                        className="px-2 py-1 rounded bg-primary text-primary-foreground text-[11px] font-semibold flex items-center gap-1"
                      >
                        {isSavingEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3.5 pt-3 border-t grid grid-cols-2 gap-2 text-xs">
                    <div
                      onClick={() => startEditUser(member)}
                      className="cursor-pointer hover:bg-muted/40 p-1.5 rounded-md transition-colors"
                      title="Click to edit role"
                    >
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        Project Role
                      </span>
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        {member.projectRole || "Team Member"}
                        <Edit2 size={11} className="opacity-0 group-hover:opacity-100 text-muted-foreground" />
                      </span>
                    </div>

                    <div
                      onClick={() => startEditUser(member)}
                      className="cursor-pointer hover:bg-muted/40 p-1.5 rounded-md transition-colors"
                      title="Click to edit rate"
                    >
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        Hourly Rate
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
                        ${member.hourlyRate || 0}/hr
                        <Edit2 size={11} className="opacity-0 group-hover:opacity-100 text-muted-foreground" />
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Details Footer */}
              <div className="mt-3 pt-3 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                  <CheckSquare size={12} className="text-blue-500" />
                  <span>{member.openTasksCount || 0} Open Tasks</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium font-mono text-purple-600 dark:text-purple-400">
                  <Clock size={12} />
                  <span>{member.totalLoggedHours || "00:00 h"}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="rounded-xl border bg-card shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 border-r">User Name</th>
                  <th className="py-3 px-4 border-r">Email ID</th>
                  <th className="py-3 px-4 border-r">Project Role</th>
                  <th className="py-3 px-4 border-r">System Role</th>
                  <th className="py-3 px-4 border-r text-center">Open Tasks</th>
                  <th className="py-3 px-4 border-r text-center">Logged Hours</th>
                  <th className="py-3 px-4 border-r text-right">Hourly Rate</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-accent/30 transition-colors group"
                  >
                    {/* User Name */}
                    <td className="py-3 px-4 border-r whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shadow-xs cursor-pointer ${getAvatarColor(
                            member.name
                          )}`}
                          onClick={() => setSelectedDrawerUserId(member.id)}
                        >
                          {getInitials(member.name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              onClick={() => setSelectedDrawerUserId(member.id)}
                              className="font-bold text-foreground hover:text-primary cursor-pointer transition-colors"
                            >
                              {member.name}
                            </span>
                            {member.isOwner && (
                              <span className="rounded bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-bold text-amber-600 dark:text-amber-400 font-mono">
                                Owner
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground block">
                            {member.department || "Development"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Email ID */}
                    <td className="py-3 px-4 border-r font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {member.email}
                    </td>

                    {/* Project Role */}
                    <td className="py-3 px-4 border-r whitespace-nowrap font-medium text-foreground">
                      <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary font-semibold">
                        {member.projectRole || "Team Member"}
                      </span>
                    </td>

                    {/* System Role */}
                    <td className="py-3 px-4 border-r whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                      {member.role}
                    </td>

                    {/* Open Tasks */}
                    <td className="py-3 px-4 border-r text-center font-bold text-blue-600 dark:text-blue-400 font-mono">
                      {member.openTasksCount || 0}
                    </td>

                    {/* Logged Hours */}
                    <td className="py-3 px-4 border-r text-center font-bold text-purple-600 dark:text-purple-400 font-mono">
                      {member.totalLoggedHours || "00:00 h"}
                    </td>

                    {/* Hourly Rate */}
                    <td className="py-3 px-4 border-r text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      ${member.hourlyRate || 0}/hr
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedDrawerUserId(member.id)}
                          className="p-1 text-muted-foreground hover:text-primary transition-colors"
                          title="Inspect Details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditUser(member)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit Role & Rate"
                        >
                          <Edit2 size={15} />
                        </button>
                        {!member.isOwner && (
                          <button
                            type="button"
                            onClick={() => setUserToRemove(member)}
                            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                            title="Remove User"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Users Modal */}
      <AddProjectUsersModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        projectId={projectId}
        onUsersAdded={fetchMembers}
      />

      {/* User Detail Slide-over Drawer */}
      <UserDetailDrawer
        isOpen={!!selectedDrawerUserId}
        onClose={() => setSelectedDrawerUserId(null)}
        projectId={projectId}
        userId={selectedDrawerUserId}
      />

      {/* Remove User & Reassign Modal */}
      <RemoveUserReassignModal
        isOpen={!!userToRemove}
        onClose={() => setUserToRemove(null)}
        userToRemove={userToRemove}
        otherMembers={members.filter((m) => m.id !== userToRemove?.id)}
        onConfirmRemove={handleConfirmRemoveUser}
      />
    </div>
  );
}
