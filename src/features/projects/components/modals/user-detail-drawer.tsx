"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Mail,
  Building2,
  Calendar,
  DollarSign,
  Clock,
  CheckSquare,
  AlertCircle,
  Loader2,
  Shield,
  Briefcase,
  MapPin,
} from "lucide-react";
import { getUserProjectDetailsDrawerAction } from "../../actions/project-actions";

interface UserDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  userId: string | null;
}

interface UserDrawerTaskItem {
  id: string;
  code?: string;
  title: string;
  status: string;
  deadline?: string;
  progressPercent?: number;
}

interface UserDrawerTimeLogItem {
  id: string;
  task?: { title: string };
  hours: string;
  date: string;
  billingType?: string;
  logType?: string;
  notes?: string;
}

interface UserDrawerDetails {
  user: {
    id: string;
    name: string;
    email: string;
    role?: string;
    profileRole?: string;
    department?: string;
    title?: string;
  };
  member: {
    projectRole?: string;
    hourlyRate?: number;
    costRate?: number;
    weeklyCapacity?: number;
    status?: string;
    joinedAt?: string;
  };
  stats: {
    totalLoggedHours: string;
    assignedTasksCount: number;
    completedTasksCount: number;
  };
  timeStats?: {
    billableLogged?: string;
    nonBillableLogged?: string;
  };
  tasks: UserDrawerTaskItem[];
  timeLogs: UserDrawerTimeLogItem[];
}

export function UserDetailDrawer({
  isOpen,
  onClose,
  projectId,
  userId,
}: UserDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "TASKS" | "TIME_LOGS">("OVERVIEW");
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<UserDrawerDetails | null>(null);

  useEffect(() => {
    if (isOpen && userId && projectId) {
      setTimeout(() => setLoading(true), 0);
      getUserProjectDetailsDrawerAction(projectId, userId)
        .then((res) => {
          setDetails(res as unknown as UserDrawerDetails);
        })
        .catch((err) => {
          console.error("Failed to load user details:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, projectId, userId]);

  if (!isOpen || !userId) return null;

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status?.toUpperCase()) {
      case "COMPLETED":
      case "CLOSED":
      case "DONE":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "IN_PROGRESS":
      case "WORKING":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      default:
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end transition-opacity animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg bg-background border-l shadow-2xl h-full flex flex-col z-10 transition-transform duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-2">
            <User size={18} className="text-primary" />
            <h3 className="text-base font-bold text-foreground">User Profile & Activity</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-xs text-muted-foreground font-medium">Loading user project details...</p>
          </div>
        ) : !details ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-2 p-6 text-destructive">
            <AlertCircle size={28} />
            <p className="text-sm font-semibold">User details not found.</p>
          </div>
        ) : (
          <>
            {/* Top Profile Summary Card */}
            <div className="p-6 border-b bg-card space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold shadow-md">
                    {getInitials(details.user.name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-foreground leading-tight">
                        {details.user.name}
                      </h2>
                      {details.user.isOwner && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono">
                          Owner
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 font-mono">
                      <Mail size={12} />
                      {details.user.email}
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    details.user.status === "ACTIVE"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {details.user.status || "ACTIVE"}
                </span>
              </div>

              {/* Roles & Info Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border">
                  <Briefcase size={14} className="text-primary" />
                  <div>
                    <div className="text-[10px] text-muted-foreground">Project Role</div>
                    <div className="font-semibold text-foreground">{details.user.projectRole}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border">
                  <Shield size={14} className="text-primary" />
                  <div>
                    <div className="text-[10px] text-muted-foreground">System Role</div>
                    <div className="font-semibold text-foreground">{details.user.role}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border">
                  <DollarSign size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <div className="text-[10px] text-muted-foreground">Hourly Rate</div>
                    <div className="font-semibold text-foreground font-mono">
                      ${details.user.hourlyRate}/hr
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border">
                  <Clock size={14} className="text-blue-600 dark:text-blue-400" />
                  <div>
                    <div className="text-[10px] text-muted-foreground">Weekly Capacity</div>
                    <div className="font-semibold text-foreground font-mono">
                      {details.user.weeklyCapacity || 40} hrs
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center border-b px-6 bg-muted/10 font-semibold text-xs gap-6">
              <button
                type="button"
                onClick={() => setActiveTab("OVERVIEW")}
                className={`py-3 relative transition-colors ${
                  activeTab === "OVERVIEW"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("TASKS")}
                className={`py-3 relative transition-colors flex items-center gap-1.5 ${
                  activeTab === "TASKS"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Assigned Tasks</span>
                <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] text-primary">
                  {details.tasks.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("TIME_LOGS")}
                className={`py-3 relative transition-colors flex items-center gap-1.5 ${
                  activeTab === "TIME_LOGS"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Time Logs</span>
                <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-mono text-primary">
                  {details.timeStats.totalLogged}
                </span>
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {activeTab === "OVERVIEW" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      User Attributes
                    </h4>
                    <div className="space-y-2 rounded-xl border bg-card p-4 text-xs">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Building2 size={14} /> Department
                        </span>
                        <span className="font-semibold text-foreground">
                          {details.user.department || "Development"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b py-2">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Briefcase size={14} /> Job Title
                        </span>
                        <span className="font-semibold text-foreground">
                          {details.user.title || "Team Member"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b py-2">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <MapPin size={14} /> Location
                        </span>
                        <span className="font-semibold text-foreground">
                          {details.user.location || "Remote"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Calendar size={14} /> Joined Date
                        </span>
                        <span className="font-semibold text-foreground">
                          {new Date(details.user.joinedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Hours Breakdown */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Project Hours Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border bg-emerald-500/5 p-3 text-xs border-emerald-500/20">
                        <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                          Billable Logged
                        </div>
                        <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 font-mono mt-1">
                          {details.timeStats.billableLogged}
                        </div>
                      </div>
                      <div className="rounded-xl border bg-blue-500/5 p-3 text-xs border-blue-500/20">
                        <div className="text-blue-600 dark:text-blue-400 font-medium">
                          Non-Billable Logged
                        </div>
                        <div className="text-lg font-bold text-blue-700 dark:text-blue-300 font-mono mt-1">
                          {details.timeStats.nonBillableLogged}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "TASKS" && (
                <div className="space-y-3">
                  {details.tasks.length === 0 ? (
                    <div className="p-8 text-center border border-dashed rounded-xl space-y-2 text-muted-foreground">
                      <CheckSquare size={24} className="mx-auto" />
                      <p className="text-xs">No tasks currently assigned to this user in this project.</p>
                    </div>
                  ) : (
                    details.tasks.map((t: UserDrawerTaskItem) => (
                      <div
                        key={t.id}
                        className="rounded-xl border bg-card p-3 shadow-2xs space-y-2 hover:border-primary/40 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                              #{t.code || t.id.slice(-5)}
                            </span>
                            <h5 className="text-xs font-bold text-foreground leading-snug">
                              {t.title}
                            </h5>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadgeClass(
                              t.status
                            )}`}
                          >
                            {t.status}
                          </span>
                        </div>

                        {t.deadline && (
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
                            <span>Deadline: {t.deadline}</span>
                            <span>Progress: {t.progressPercent || 0}%</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "TIME_LOGS" && (
                <div className="space-y-3">
                  {details.timeLogs.length === 0 ? (
                    <div className="p-8 text-center border border-dashed rounded-xl space-y-2 text-muted-foreground">
                      <Clock size={24} className="mx-auto" />
                      <p className="text-xs">No time log entries recorded for this user in this project.</p>
                    </div>
                  ) : (
                    details.timeLogs.map((log: UserDrawerTimeLogItem) => (
                      <div
                        key={log.id}
                        className="rounded-xl border bg-card p-3 shadow-2xs space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            {log.task?.title || "Project Log"}
                          </span>
                          <span className="font-mono font-bold text-primary">
                            {log.hours}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{log.date}</span>
                          <span
                            className={`font-semibold ${
                              log.logType?.toUpperCase() === "BILLABLE"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {log.logType || "Billable"}
                          </span>
                        </div>
                        {log.notes && (
                          <p className="text-[11px] text-muted-foreground bg-muted/40 p-1.5 rounded mt-1 font-mono">
                            {log.notes}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
