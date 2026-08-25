"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
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
  getCurrentUserRoleAction,
  inviteUserAction,
  updateUserRoleAction,
  getMyTaskCountAction,
} from "../actions/project-actions";
import {
  MemberRoleTier,
  NewProjectFormData,
  Project,
  ProfileRoleValue,
  ProjectUser,
  TaskItem,
  UserTimeGroup,
  UserType,
  WorkspaceRole,
} from "../types";
import { AllProjectsTableView } from "./views/all-projects-table-view";
import { UsersTableView } from "./views/users-table-view";
import { TasksBoardView } from "./views/tasks-board-view";
import { TimeTrackerView } from "./views/time-tracker-view";
import { GanttTimelineView } from "./views/gantt-timeline-view";
import { ReportsView } from "./views/reports-view";
import { ClientPortalView } from "./views/client-portal-view";
import { AdminSettingsView } from "./views/admin-settings-view";
import { AddProjectDrawer } from "./modals/add-project-drawer";
import { InviteMemberModal, InviteFormSubmission } from "./modals/invite-member-modal";
import { ProjectTemplatesModal } from "./modals/project-templates-modal";

export function ProjectsWorkspace() {
  const pathname = usePathname();

  const [userRole, setUserRole] = useState<WorkspaceRole>("TEAM_MEMBER"); // Defaults to Team Member View per user request

  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [timeGroups, setTimeGroups] = useState<UserTimeGroup[]>([]);
  const [myTaskCount, setMyTaskCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [inviteUserType, setInviteUserType] = useState<UserType>("PORTAL");

  // Determine activeNav view based on current route pathname
  let activeNav:
    | "ALL_PROJECTS"
    | "USERS"
    | "COLLABORATION"
    | "MY_TASKS"
    | "TIME_TRACKER"
    | "TIMELINE"
    | "REPORTS"
    | "CLIENT_PORTAL"
    | "ARCHIVE"
    | "SETTINGS" = "ALL_PROJECTS";

  if (pathname === "/projects/users") {
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
        const [fetchedProjects, fetchedTasks, fetchedLogs, fetchedUsers, fetchedRole, fetchedMyTaskCount] =
          await Promise.all([
            getProjectsAction(),
            getTasksAction(),
            getTimeLogsAction(),
            getUsersAction(),
            getCurrentUserRoleAction(),
            getMyTaskCountAction(),
          ]);

        setProjects(fetchedProjects);
        setTasks(fetchedTasks);
        setTimeGroups(fetchedLogs);
        setUsers(fetchedUsers);
        setUserRole(fetchedRole);
        setMyTaskCount(fetchedMyTaskCount);
      } catch (err) {
        console.error("Failed to load project data from database:", err);
        setError("Failed to connect to database. Please refresh.");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const handleAddProject = async (data: NewProjectFormData) => {
    setIsLoading(true);
    try {
      const createdProject = await createProjectAction(data);

      if (createdProject) {
        setProjects((prev) => [createdProject, ...prev]);
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

  const handleInviteUser = async (data: InviteFormSubmission) => {
    const createdUser = await inviteUserAction(
      data.email,
      data.name,
      data.role,
      "Development",
      undefined,
      data.projectIds
    );
    setUsers((prev) => [createdUser, ...prev]);
  };

  const handleUpdateUserRole = async (
    userId: string,
    role: MemberRoleTier,
    profileRole: ProfileRoleValue
  ) => {
    const updatedUser = await updateUserRoleAction(userId, role, profileRole);
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
  };

  const handleAddTask = (newTask: TaskItem) => {
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleUpdateTask = async (updatedTask: TaskItem) => {
    const previous = tasks.find((t) => t.id === updatedTask.id);
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    const result = await updateTaskAction(updatedTask.id, updatedTask);
    if (!result.success) {
      if (previous) {
        setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? previous : t)));
      }
      alert(result.error || "You do not have permission to edit this task.");
    }
  };

  const handleOpenInviteModal = (type: UserType) => {
    setInviteUserType(type);
    setIsInviteModalOpen(true);
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
                assignedToMeCount={myTaskCount}
                onOpenTemplatesModal={() => setIsTemplatesModalOpen(true)}
              />
            )}

            {activeNav === "USERS" && (
              <UsersTableView
                users={users}
                onOpenInviteModal={handleOpenInviteModal}
                onUpdateUserRole={handleUpdateUserRole}
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

            {activeNav === "COLLABORATION" && (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Share2 size={32} className="text-primary mb-2" />
                <h3 className="text-lg font-bold text-foreground">Team Collaboration</h3>
                <p className="text-xs max-w-sm mt-1">
                  Share project updates, discuss milestones, and collaborate in real-time.
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
        projects={projects}
      />

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInviteUser={handleInviteUser}
        defaultUserType={inviteUserType}
        projects={projects}
        portalUserCount={users.filter((u) => u.userType === "PORTAL").length}
        clientUserCount={users.filter((u) => u.userType === "CLIENT").length}
      />

      {/* Project Templates Library Modal */}
      <ProjectTemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
      />
    </div>
  );
}
