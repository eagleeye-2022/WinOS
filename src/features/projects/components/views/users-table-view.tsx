"use client";

import React, { useState } from "react";
import { Clock, Settings, UserPlus, ArrowUpDown } from "lucide-react";
import { ProjectUser, UserType } from "../../types";

interface UsersTableViewProps {
  users: ProjectUser[];
  onOpenInviteModal: (type: UserType) => void;
}

export function UsersTableView({
  users,
  onOpenInviteModal,
}: UsersTableViewProps) {
  const [activeTab, setActiveTab] = useState<UserType>("PORTAL");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const filteredUsers = users.filter((u) => u.userType === activeTab);

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

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">Users</h1>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-accent"
            title="User Logs"
          >
            <Clock size={18} />
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-accent"
            title="User Settings"
          >
            <Settings size={18} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onOpenInviteModal(activeTab)}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
        >
          <UserPlus size={16} />
          {activeTab === "PORTAL" ? "Invite New Member" : "Invite Client"}
        </button>
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
                ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Portal Users
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("CLIENT");
              setSelectedUserIds([]);
            }}
            className={`pb-3 transition-colors relative ${
              activeTab === "CLIENT"
                ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Client Users
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground font-medium">
              <th className="py-3 px-4 w-10 text-center border-r">
                <input
                  type="checkbox"
                  checked={
                    filteredUsers.length > 0 &&
                    selectedUserIds.length === filteredUsers.length
                  }
                  onChange={handleSelectAll}
                  className="rounded border-input text-blue-600 focus:ring-blue-500 h-4 w-4"
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
                  <th className="py-3 px-4 whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      PORTAL PROFILE <ArrowUpDown size={12} />
                    </span>
                  </th>
                </>
              ) : (
                <>
                  <th className="py-3 px-4 border-r whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      PROJECTS <ArrowUpDown size={12} />
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
                <td colSpan={5} className="py-12 text-center text-muted-foreground">
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
                      className="rounded border-input text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                  </td>

                  {/* USER NAME */}
                  <td className="py-3 px-4 border-r whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                          user.avatarColor || "bg-blue-600 text-white"
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
                      <td className="py-3 px-4 border-r whitespace-nowrap">
                        {user.role === "REPORTING MANAGER 1" && (
                          <span className="inline-block rounded bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            REPORTING MANAGER 1
                          </span>
                        )}
                        {user.role === "TEAM MEMBER" && (
                          <span className="inline-block rounded bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            TEAM MEMBER
                          </span>
                        )}
                        {user.role === "ADMINISTRATOR" && (
                          <span className="inline-block rounded bg-blue-100 dark:bg-blue-950/60 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                            ADMINISTRATOR
                          </span>
                        )}
                      </td>

                      {/* PORTAL PROFILE */}
                      <td className="py-3 px-4 text-foreground font-medium whitespace-nowrap">
                        {user.portalProfile || "Employee"}
                      </td>
                    </>
                  ) : (
                    <>
                      {/* PROJECTS */}
                      <td className="py-3 px-4 border-r text-foreground font-medium whitespace-nowrap">
                        {user.projects || "—"}
                      </td>

                      {/* ROLE */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-block rounded-full bg-purple-100 dark:bg-purple-950/60 px-3 py-0.5 text-[11px] font-semibold text-purple-600 dark:text-purple-300">
                          Client
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
        <span>Total Count: 15</span>
        <span>Rows per page: 15</span>
      </div>
    </div>
  );
}
