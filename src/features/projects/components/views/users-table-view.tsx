"use client";

import React, { useState } from "react";
import {
  Clock,
  Settings,
  UserPlus,
  ArrowUpDown,
  Search,
  Download,
  Users,
  Building2,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { MemberRoleTier, ProfileRoleValue, ProjectUser, UserType } from "../../types";

const ROLE_BADGE_CONFIG: Record<MemberRoleTier, { label: string; className: string }> = {
  ADMIN: { label: "ADMINISTRATOR", className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  MANAGER: { label: "REPORTING MANAGER", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  TEAM_MEMBER: { label: "TEAM MEMBER", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
};

const PROFILE_ROLE_OPTIONS: ProfileRoleValue[] = [
  "EMPLOYEE",
  "CONTRACTOR",
  "GUEST",
  "DEVELOPER",
  "SUPPORT",
  "PORTAL_OWNER",
  "ADMIN",
  "MANAGER",
];

interface UsersTableViewProps {
  users: ProjectUser[];
  onOpenInviteModal: (type: UserType) => void;
  onUpdateUserRole: (userId: string, role: MemberRoleTier, profileRole: ProfileRoleValue) => void;
}

export function UsersTableView({
  users,
  onOpenInviteModal,
  onUpdateUserRole,
}: UsersTableViewProps) {
  const [activeTab, setActiveTab] = useState<UserType>("PORTAL");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = users
    .filter((u) => u.userType === activeTab)
    .filter(
      (u) =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.portalProfile && u.portalProfile.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  const handleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map((u) => u.id));
    }
  };

  const handleToggleUser = (id: string) => {
    if (selectedUserIds.includes(id)) {
      setSelectedUserIds(selectedUserIds.filter((uId) => uId !== id));
    } else {
      setSelectedUserIds([...selectedUserIds, id]);
    }
  };

  const exportCSV = () => {
    const headers = ["Name", "Email", "User Type", "Role", "Portal Profile", "Projects"];
    const rows = filteredUsers.map((u) => [
      `"${u.name}"`,
      `"${u.email}"`,
      `"${u.userType}"`,
      `"${u.role}"`,
      `"${u.portalProfile || "Employee"}"`,
      `"${u.projects || "All"}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `zoho_portal_users_${activeTab.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b px-6 py-4 gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">Portal Users</h1>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary font-mono">
            {filteredUsers.length} Users
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative w-60">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Search portal users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            type="button"
            onClick={exportCSV}
            className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
            title="Export CSV"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenInviteModal(activeTab)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            <UserPlus size={15} />
            {activeTab === "PORTAL" ? "Invite New Member" : "Invite Client"}
          </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center justify-between border-b px-6 pt-3 pb-0 bg-background">
        <div className="flex gap-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveTab("PORTAL");
              setSelectedUserIds([]);
            }}
            className={`pb-3 transition-colors relative ${
              activeTab === "PORTAL"
                ? "text-primary border-b-2 border-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Portal Users ({users.filter((u) => u.userType === "PORTAL").length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("CLIENT");
              setSelectedUserIds([]);
            }}
            className={`pb-3 transition-colors relative ${
              activeTab === "CLIENT"
                ? "text-primary border-b-2 border-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Client Users ({users.filter((u) => u.userType === "CLIENT").length})
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4 w-10 text-center border-r">
                <input
                  type="checkbox"
                  checked={
                    filteredUsers.length > 0 &&
                    selectedUserIds.length === filteredUsers.length
                  }
                  onChange={handleSelectAll}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                />
              </th>
              <th className="py-3 px-4 border-r whitespace-nowrap">
                <span className="flex items-center gap-1">
                  USER NAME <ArrowUpDown size={12} />
                </span>
              </th>
              <th className="py-3 px-4 border-r whitespace-nowrap">
                <span className="flex items-center gap-1">
                  EMAIL ID <ArrowUpDown size={12} />
                </span>
              </th>

              {activeTab === "PORTAL" ? (
                <>
                  <th className="py-3 px-4 border-r whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      ROLE <ArrowUpDown size={12} />
                    </span>
                  </th>
                  <th className="py-3 px-4 border-r whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      PORTAL PROFILE <ArrowUpDown size={12} />
                    </span>
                  </th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">
                    STATUS
                  </th>
                </>
              ) : (
                <>
                  <th className="py-3 px-4 border-r whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      ACCESSIBLE PROJECTS <ArrowUpDown size={12} />
                    </span>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      ROLE <ArrowUpDown size={12} />
                    </span>
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                  No users found in this category.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-accent/30 transition-colors"
                >
                  <td className="py-3 px-4 border-r text-center">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={() => handleToggleUser(user.id)}
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                  </td>

                  {/* USER NAME */}
                  <td className="py-3 px-4 border-r whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${
                          user.avatarColor || "bg-primary text-primary-foreground"
                        }`}
                      >
                        {user.initials}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">
                          {user.name}
                        </span>
                        {user.statusText && (
                          <span className="text-[10px] text-muted-foreground">
                            {user.statusText}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* EMAIL ID */}
                  <td className="py-3 px-4 border-r font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {user.email}
                  </td>

                  {activeTab === "PORTAL" ? (
                    <>
                      {/* ROLE */}
                      <td className="py-3 px-4 border-r whitespace-nowrap relative">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingUserId(editingUserId === user.id ? null : user.id)
                          }
                          className={`inline-block rounded-md px-2.5 py-0.5 text-[10px] font-bold cursor-pointer hover:opacity-80 transition-opacity ${ROLE_BADGE_CONFIG[user.role]?.className || "bg-muted text-muted-foreground"}`}
                        >
                          {ROLE_BADGE_CONFIG[user.role]?.label || user.role}
                        </button>

                        {editingUserId === user.id && (
                          <RoleEditorPopover
                            user={user}
                            onClose={() => setEditingUserId(null)}
                            onSave={(role, profileRole) => {
                              onUpdateUserRole(user.id, role, profileRole);
                              setEditingUserId(null);
                            }}
                          />
                        )}
                      </td>

                      {/* PORTAL PROFILE */}
                      <td className="py-3 px-4 border-r text-foreground font-medium whitespace-nowrap">
                        {user.portalProfile || "Employee"}
                      </td>

                      {/* STATUS */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={11} />
                          Active
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      {/* PROJECTS */}
                      <td className="py-3 px-4 border-r text-foreground font-medium whitespace-nowrap">
                        {user.projects || "All Projects"}
                      </td>

                      {/* ROLE */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-block rounded-full bg-primary/10 px-3 py-0.5 text-[11px] font-semibold text-primary">
                          Client User
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Bar */}
      <div className="flex items-center justify-between border-t px-6 py-3 bg-muted/20 text-xs text-muted-foreground font-medium">
        <span>Total Count: {filteredUsers.length}</span>
        <span>Rows per page: {filteredUsers.length}</span>
      </div>
    </div>
  );
}

function RoleEditorPopover({
  user,
  onClose,
  onSave,
}: {
  user: ProjectUser;
  onClose: () => void;
  onSave: (role: MemberRoleTier, profileRole: ProfileRoleValue) => void;
}) {
  const [role, setRole] = useState<MemberRoleTier>(user.role);
  const [profileRole, setProfileRole] = useState<ProfileRoleValue>(user.profileRole);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border bg-popover p-3 shadow-lg text-left">
        <div className="space-y-2">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground">System Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRoleTier)}
              className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="TEAM_MEMBER">Team Member</option>
              <option value="MANAGER">Reporting Manager</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground">
              Portal Profile
            </label>
            <select
              value={profileRole}
              onChange={(e) => setProfileRole(e.target.value as ProfileRoleValue)}
              className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {PROFILE_ROLE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.charAt(0) + opt.slice(1).toLowerCase().replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => onSave(role, profileRole)}
            className="w-full rounded bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}
