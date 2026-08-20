"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
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
import { GanttTimelineView } from "./views/gantt-timeline-view";
import { ReportsView } from "./views/reports-view";
import { ClientPortalView } from "./views/client-portal-view";
import { AdminSettingsView } from "./views/admin-settings-view";
import { AddProjectDrawer } from "./modals/add-project-drawer";
import { InviteMemberModal } from "./modals/invite-member-modal";
import { ProjectTemplatesModal } from "./modals/project-templates-modal";

export function ProjectsWorkspace() {
  const pathname = usePathname();

  const [userRole, setUserRole] = useState<WorkspaceRole>("TEAM_MEMBER"); // Defaults to Team Member View per user request

  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [timeGroups, setTimeGroups] = useState<UserTimeGroup[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRecentProject, setSelectedRecentProject] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [inviteUserType, setInviteUserType] = useState<UserType>("PORTAL");

  // Determine activeNav view based on current route pathname
  let activeNav:
    | "HOME"
    | "ALL_PROJECTS"
    | "USERS"
    | "COLLABORATION"
    | "MY_TASKS"
    | "TIME_TRACKER"
    | "TIMELINE"
    | "REPORTS"
    | "CLIENT_PORTAL"
    | "RECENT_PROJECT"
    | "ARCHIVE"
    | "SETTINGS" = "ALL_PROJECTS";

  if (pathname === "/projects/home") {
    activeNav = "HOME";
  } else if (pathname === "/projects/users") {
    activeNav = "USERS";
  } else if (pathname === "/projects/collaboration") {
    activeNav = "COLLABORATION";
  } else if (pathname === "/projects/my-tasks" || pathname === "/projects/tasks") {
    activeNav = "MY_TASKS";
  } else if (pathname === "/projects/time-tracker") {
    activeNav = "TIME_TRACKER";
  } else if (pathname === "/projects/timeline") {
    activeNav = "TIMELINE";
  } else if (pathname === "/projects/reports") {
    activeNav = "REPORTS";
  } else if (pathname === "/projects/portal" || pathname === "/projects/client-portal") {
    activeNav = "CLIENT_PORTAL";
  } else if (pathname === "/projects/recent") {
    activeNav = "RECENT_PROJECT";
  } else if (pathname === "/projects/archive") {
    activeNav = "ARCHIVE";
  } else if (pathname === "/projects/settings") {
    activeNav = "SETTINGS";
  } else {
    activeNav = "ALL_PROJECTS";
  }

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
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Left Sidebar Navigation */}


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

            {activeNav === "USERS" && (
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

            {activeNav === "TIMELINE" && <GanttTimelineView />}

            {activeNav === "REPORTS" && <ReportsView />}

            {activeNav === "CLIENT_PORTAL" && <ClientPortalView />}

            {activeNav === "SETTINGS" && <AdminSettingsView />}

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

      {/* Project Templates Library Modal */}
      <ProjectTemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
      />
    </div>
  );
}
