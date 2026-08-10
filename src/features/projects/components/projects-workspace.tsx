"use client";

import React, { useState, useEffect } from "react";
import {
  Home,
  FolderKanban,
  Users,
  Share2,
  CheckSquare,
  Clock,
  FileText,
  Quote,
  Archive,
  Settings,
  Loader2,
  AlertCircle,
  Shield,
  UserCheck,
} from "lucide-react";
import {
  getProjectsAction,
  createProjectAction,
  deleteProjectAction,
  getTasksAction,
  updateTaskAction,
  getTimeLogsAction,
  getUsersAction,
} from "../actions/project-actions";
import { Project, ProjectUser, TaskItem, UserTimeGroup, UserType, WorkspaceRole } from "../types";
import { AllProjectsTableView } from "./views/all-projects-table-view";
import { UsersTableView } from "./views/users-table-view";
import { TasksBoardView } from "./views/tasks-board-view";
import { TimeTrackerView } from "./views/time-tracker-view";
import { AddProjectDrawer } from "./modals/add-project-drawer";
import { InviteMemberModal } from "./modals/invite-member-modal";

export function ProjectsWorkspace() {
  const [userRole, setUserRole] = useState<WorkspaceRole>("TEAM_MEMBER"); // Defaults to Team Member View per user request

  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [timeGroups, setTimeGroups] = useState<UserTimeGroup[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeNav, setActiveNav] = useState<
    | "HOME"
    | "ALL_PROJECTS"
    | "USERS"
    | "COLLABORATION"
    | "MY_TASKS"
    | "TIME_TRACKER"
    | "RECENT_PROJECT"
    | "ARCHIVE"
    | "SETTINGS"
  >("MY_TASKS"); // Active on My Tasks per uploaded screenshot

  const [selectedRecentProject, setSelectedRecentProject] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteUserType, setInviteUserType] = useState<UserType>("PORTAL");

  // Load dynamic data from PostgreSQL Database via Server Actions
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [fetchedProjects, fetchedTasks, fetchedLogs, fetchedUsers] =
          await Promise.all([
            getProjectsAction(),
            getTasksAction(),
            getTimeLogsAction(),
            getUsersAction(),
          ]);

        setProjects(fetchedProjects);
        setTasks(fetchedTasks);
        setTimeGroups(fetchedLogs);
        setUsers(fetchedUsers);
      } catch (err) {
        console.error("Failed to load project data from database:", err);
        setError("Failed to connect to database. Please refresh.");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAddProject = async (newProjData: any) => {
    setIsLoading(true);
    try {
      const res = await createProjectAction({
        name: newProjData.name,
        phases: newProjData.phases,
        owner: newProjData.owner?.name || newProjData.owner,
        workHours: newProjData.totalHours,
        startDate: newProjData.startDate,
        dueDate: newProjData.deadline,
        description: newProjData.description,
      });

      if (res.success && res.project) {
        setProjects((prev) => [res.project!, ...prev]);
      }
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    await deleteProjectAction(id);
  };

  const handleInviteUser = (newUser: ProjectUser) => {
    setUsers((prev) => [newUser, ...prev]);
  };

  const handleAddTask = (newTask: TaskItem) => {
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleUpdateTask = async (updatedTask: TaskItem) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    await updateTaskAction(updatedTask.id, updatedTask);
  };

  const handleOpenInviteModal = (type: UserType) => {
    setInviteUserType(type);
    setIsInviteModalOpen(true);
  };

  const handleSelectRecentProject = (name: string) => {
    setSelectedRecentProject(name);
    setActiveNav("RECENT_PROJECT");
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Left Sidebar Navigation */}
      <aside className="w-64 border-r border-border bg-card flex flex-col justify-between select-none shrink-0">
        <div className="flex flex-col py-4">
          {/* Sidebar Header & Role Switcher Toggle */}
          <div className="px-5 pb-3 border-b space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-foreground tracking-wide">
                  Projects
                </h2>
                <span className="text-[11px] text-muted-foreground">Workspace</span>
              </div>

              {/* Interactive View Role Switcher */}
              <button
                type="button"
                onClick={() =>
                  setUserRole(userRole === "ADMIN" ? "TEAM_MEMBER" : "ADMIN")
                }
                className="flex items-center gap-1 rounded-full border border-info/30 bg-info/10 px-2.5 py-1 text-[10px] font-bold text-info hover:bg-info/15 transition-colors"
                title="Click to toggle Admin / Team Member perspective"
              >
                {userRole === "ADMIN" ? (
                  <>
                    <Shield size={11} className="text-amber-500" /> Admin View
                  </>
                ) : (
                  <>
                    <UserCheck size={11} className="text-primary" /> Member View
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Primary Nav Items */}
          <nav className="px-2 pt-3 space-y-1">
            {/* Home (Admin View only) */}
            {userRole === "ADMIN" && (
              <button
                type="button"
                onClick={() => setActiveNav("HOME")}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                  activeNav === "HOME"
                    ? "bg-accent text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Home size={16} />
                <span>Home</span>
              </button>
            )}

            {/* All Projects */}
            <button
              type="button"
              onClick={() => setActiveNav("ALL_PROJECTS")}
              className={`flex w-full items-center gap-3 rounded-r-md px-3 py-2 text-xs font-semibold transition-all relative ${
                activeNav === "ALL_PROJECTS"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {activeNav === "ALL_PROJECTS" && (
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
              )}
              <FolderKanban size={16} />
              <span>All Projects</span>
            </button>

            {/* Users (Admin View only) */}
            {userRole === "ADMIN" && (
              <button
                type="button"
                onClick={() => setActiveNav("USERS")}
                className={`flex w-full items-center gap-3 rounded-r-md px-3 py-2 text-xs font-semibold transition-all relative ${
                  activeNav === "USERS"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {activeNav === "USERS" && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
                )}
                <Users size={16} />
                <span>Users</span>
              </button>
            )}

            {/* Collaboration */}
            <button
              type="button"
              onClick={() => setActiveNav("COLLABORATION")}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                activeNav === "COLLABORATION"
                  ? "bg-accent text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Share2 size={16} />
              <span>Collaboration</span>
            </button>
          </nav>

          {/* Section: Overview */}
          <div className="mt-6 px-4">
            <h3 className="text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase mb-2">
              Overview
            </h3>
            <div className="space-y-1">
              {/* My Tasks (Matching Image 1) */}
              <button
                type="button"
                onClick={() => setActiveNav("MY_TASKS")}
                className={`flex w-full items-center gap-3 rounded-r-md px-3 py-1.5 text-xs font-semibold transition-all relative ${
                  activeNav === "MY_TASKS"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {activeNav === "MY_TASKS" && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
                )}
                <CheckSquare size={15} />
                <span>My Tasks</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveNav("TIME_TRACKER")}
                className={`flex w-full items-center gap-3 rounded-r-md px-3 py-1.5 text-xs font-semibold transition-all relative ${
                  activeNav === "TIME_TRACKER"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {activeNav === "TIME_TRACKER" && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
                )}
                <Clock size={15} />
                <span>Time Tracker</span>
              </button>
            </div>
          </div>

          {/* Section: Recent Projects */}
          <div className="mt-6 px-4">
            <h3 className="text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase mb-2">
              Recent Projects
            </h3>
            <div className="space-y-1">
              {["ABCD", "EFGH", "IJKL", "MNOP"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleSelectRecentProject(item)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    activeNav === "RECENT_PROJECT" && selectedRecentProject === item
                      ? "bg-accent text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <FileText size={14} />
                  <span>{item}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Footer Section */}
        <div className="p-4 space-y-4 border-t">
          {/* Steve Jobs Quote Card */}
          <div className="relative overflow-hidden rounded-xl border border-info/20 bg-info/5 p-3.5">
            <div className="flex items-start gap-2">
              <Quote size={16} className="text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[11px] leading-tight text-foreground/80 font-medium italic">
                  &ldquo;Great things in business are never done by one person. They&apos;re done by a team of people.&rdquo;
                </p>
                <span className="block text-[10px] font-semibold text-info">
                  — Steve Jobs
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Archive & Settings */}
          <div className="space-y-1 pt-1">
            <button
              type="button"
              onClick={() => setActiveNav("ARCHIVE")}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                activeNav === "ARCHIVE"
                  ? "bg-accent text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Archive size={15} />
              <span>Archive</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNav("SETTINGS")}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                activeNav === "SETTINGS"
                  ? "bg-accent text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Settings size={15} />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Right Main Content Area */}
      <main className="flex-1 overflow-hidden bg-background">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center space-y-3">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-xs text-muted-foreground font-medium">
              Fetching workspace data from database...
            </p>
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center space-y-2 text-destructive">
            <AlertCircle size={28} />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : (
          <>
            {activeNav === "ALL_PROJECTS" && (
              <AllProjectsTableView
                projects={projects}
                onOpenAddModal={() => setIsAddModalOpen(true)}
                onDeleteProject={handleDeleteProject}
                userRole={userRole}
              />
            )}

            {activeNav === "USERS" && userRole === "ADMIN" && (
              <UsersTableView
                users={users}
                onOpenInviteModal={handleOpenInviteModal}
              />
            )}

            {activeNav === "MY_TASKS" && (
              <TasksBoardView
                tasks={tasks}
                onAddTask={handleAddTask}
                onUpdateTask={handleUpdateTask}
              />
            )}

            {activeNav === "TIME_TRACKER" && (
              <TimeTrackerView initialGroups={timeGroups} />
            )}

            {activeNav === "HOME" && (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Home size={32} className="text-primary mb-2" />
                <h3 className="text-lg font-bold text-foreground">Projects Home Overview</h3>
                <p className="text-xs max-w-sm mt-1">
                  Welcome to WinOS Projects Workspace. Select All Projects, Tasks, Users, or Time Tracker to get started.
                </p>
              </div>
            )}

            {activeNav === "COLLABORATION" && (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Share2 size={32} className="text-primary mb-2" />
                <h3 className="text-lg font-bold text-foreground">Team Collaboration</h3>
                <p className="text-xs max-w-sm mt-1">
                  Share project updates, discuss milestones, and collaborate in real-time.
                </p>
              </div>
            )}

            {activeNav === "RECENT_PROJECT" && (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <FileText size={32} className="text-primary mb-2" />
                <h3 className="text-lg font-bold text-foreground">Recent Project: {selectedRecentProject}</h3>
                <p className="text-xs max-w-sm mt-1">
                  Viewing workspace board and task details for project {selectedRecentProject}.
                </p>
              </div>
            )}

            {activeNav === "ARCHIVE" && (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Archive size={32} className="text-primary mb-2" />
                <h3 className="text-lg font-bold text-foreground">Project Archives</h3>
                <p className="text-xs max-w-sm mt-1">
                  View and restore archived projects and completed milestones.
                </p>
              </div>
            )}

            {activeNav === "SETTINGS" && (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Settings size={32} className="text-primary mb-2" />
                <h3 className="text-lg font-bold text-foreground">Workspace Settings</h3>
                <p className="text-xs max-w-sm mt-1">
                  Configure project workflows, user permissions, and custom phase defaults.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Add New Project Drawer Modal */}
      <AddProjectDrawer
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddProject={handleAddProject}
      />

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInviteUser={handleInviteUser}
        defaultUserType={inviteUserType}
      />
    </div>
  );
}
