"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  Users,
  CheckSquare,
  Clock,
  FileText,
  Quote,
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
import { toast } from "@/components/shared/toast";

/**
 * Last data this workspace showed, kept for the life of the browser tab. Navigating into a
 * project and back unmounts this page; without this, coming back meant a blank spinner and a
 * full reload. Now the cached list renders instantly and is refreshed quietly in the background.
 * Only ever written from effects/handlers (browser-side), so it is never shared across users
 * during server rendering. `null` fields mean "never loaded", not "empty".
 */
type WorkspaceCache = {
  projects: Project[];
  userRole: WorkspaceRole;
  myTaskCount: number;
  users: ProjectUser[] | null;
  tasks: TaskItem[] | null;
  timeGroups: UserTimeGroup[] | null;
};
let workspaceCache: WorkspaceCache | null = null;

export function ProjectsWorkspace() {
  const pathname = usePathname();
  const needsTasks = pathname === "/projects/my-tasks" || pathname === "/projects/tasks";
  const needsTimeLogs = pathname === "/projects/time-tracker";

  // Snapshot of the cache at mount — seeds state so a return visit paints immediately.
  const [initialCache] = useState(() => workspaceCache);
  const hasCachedView = Boolean(
    initialCache &&
      (!needsTasks || initialCache.tasks) &&
      (!needsTimeLogs || initialCache.timeGroups)
  );

  const [userRole, setUserRole] = useState<WorkspaceRole>(initialCache?.userRole ?? "TEAM_MEMBER"); // Defaults to Team Member View per user request

  const [projects, setProjects] = useState<Project[]>(initialCache?.projects ?? []);
  const [users, setUsers] = useState<ProjectUser[]>(initialCache?.users ?? []);
  const [tasks, setTasks] = useState<TaskItem[]>(initialCache?.tasks ?? []);
  const [timeGroups, setTimeGroups] = useState<UserTimeGroup[]>(initialCache?.timeGroups ?? []);
  const [myTaskCount, setMyTaskCount] = useState(initialCache?.myTaskCount ?? 0);

  const [isLoading, setIsLoading] = useState(!hasCachedView);
  const [error, setError] = useState<string | null>(null);

  // Which optional collections actually hold loaded data (vs. their [] placeholder).
  const tasksLoadedRef = React.useRef(Boolean(initialCache?.tasks));
  const timeLogsLoadedRef = React.useRef(Boolean(initialCache?.timeGroups));
  const usersLoadedRef = React.useRef(Boolean(initialCache?.users));

  // Keep the cache in step with whatever is on screen, including optimistic edits.
  useEffect(() => {
    if (isLoading) return;
    workspaceCache = {
      projects,
      userRole,
      myTaskCount,
      users: usersLoadedRef.current ? users : workspaceCache?.users ?? null,
      tasks: tasksLoadedRef.current ? tasks : workspaceCache?.tasks ?? null,
      timeGroups: timeLogsLoadedRef.current ? timeGroups : workspaceCache?.timeGroups ?? null,
    };
  }, [isLoading, projects, userRole, myTaskCount, users, tasks, timeGroups]);

  // Inline edits in the projects table live in its own local copy — mirror them into the cache
  // so returning to this page doesn't briefly show pre-edit values.
  const handleTableProjectsChange = React.useCallback((next: Project[]) => {
    if (workspaceCache) workspaceCache = { ...workspaceCache, projects: next };
  }, []);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [inviteUserType, setInviteUserType] = useState<UserType>("PORTAL");

  // Determine activeNav view based on current route pathname
  let activeNav:
    | "ALL_PROJECTS"
    | "USERS"
    | "MY_TASKS"
    | "TIME_TRACKER"
    | "TIMELINE"
    | "REPORTS"
    | "CLIENT_PORTAL"
    | "SETTINGS" = "ALL_PROJECTS";

  if (pathname === "/projects/users") {
    activeNav = "USERS";
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
  } else if (pathname === "/projects/settings") {
    activeNav = "SETTINGS";
  } else {
    activeNav = "ALL_PROJECTS";
  }

  // Load only what the active view renders. This used to fetch every task in the DB (with
  // remarks/subtasks/owners), every time log and every user on each visit to /projects, even
  // though the default "All Projects" table shows none of them.
  // With cached data on screen this runs as a silent background refresh (no spinner).
  const showSpinnerRef = React.useRef(!hasCachedView);
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      if (showSpinnerRef.current) setIsLoading(true);
      setError(null);
      try {
        const [fetchedProjects, fetchedRole, fetchedMyTaskCount, fetchedTasks, fetchedLogs] =
          await Promise.all([
            getProjectsAction(),
            getCurrentUserRoleAction(),
            getMyTaskCountAction(),
            needsTasks ? getTasksAction() : Promise.resolve(null),
            needsTimeLogs ? getTimeLogsAction() : Promise.resolve(null),
          ]);
        if (cancelled) return;

        setProjects(fetchedProjects);
        setUserRole(fetchedRole);
        setMyTaskCount(fetchedMyTaskCount);
        if (fetchedTasks) {
          tasksLoadedRef.current = true;
          setTasks(fetchedTasks);
        }
        if (fetchedLogs) {
          timeLogsLoadedRef.current = true;
          setTimeGroups(fetchedLogs);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load project data from database:", err);
        // A failed *background* refresh keeps the cached data on screen rather than an error.
        if (showSpinnerRef.current) setError("Failed to connect to database. Please refresh.");
      } finally {
        if (!cancelled) setIsLoading(false);
        showSpinnerRef.current = false;
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [needsTasks, needsTimeLogs]);

  // The user list only feeds the Users view and the invite modal's counts — load it after
  // the main view has rendered rather than blocking first paint on it.
  const usersRequestedRef = React.useRef(false);
  useEffect(() => {
    if (isLoading || usersRequestedRef.current) return;
    usersRequestedRef.current = true;
    getUsersAction()
      .then((fetchedUsers) => {
        usersLoadedRef.current = true;
        setUsers(fetchedUsers);
      })
      .catch((err) => console.error("Failed to load users:", err));
  }, [isLoading]);

  const handleAddProject = async (data: NewProjectFormData) => {
    setIsLoading(true);
    try {
      const createdProject = await createProjectAction(data);

      if (createdProject) {
        setProjects((prev) => [createdProject, ...prev]);
        toast.success(`Project "${data.name}" created successfully`);
      }
    } catch (err) {
      console.error("Failed to create project:", err);
      toast.error("Failed to create project");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    await deleteProjectAction(id);
    toast.success("Project deleted");
  };

  const handleInviteUser = async (data: InviteFormSubmission) => {
    try {
      const createdUser = await inviteUserAction(
        data.email,
        data.name,
        data.role,
        "Development",
        undefined,
        data.projectIds
      );
      setUsers((prev) => [createdUser, ...prev]);
      toast.success(`Invitation sent to ${data.email}`);
    } catch {
      toast.error("Failed to send invitation");
    }
  };

  const handleUpdateUserRole = async (
    userId: string,
    role: MemberRoleTier,
    profileRole: ProfileRoleValue
  ) => {
    try {
      const updatedUser = await updateUserRoleAction(userId, role, profileRole);
      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
      toast.success("User role updated");
    } catch {
      toast.error("Failed to update user role");
    }
  };

  const handleAddTask = (newTask: TaskItem) => {
    setTasks((prev) => [newTask, ...prev]);
    toast.success("Task created");
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
      toast.error(result.error || "You do not have permission to edit this task.");
    } else {
      toast.success("Task updated");
    }
  };

  const handleOpenInviteModal = (type: UserType) => {
    setInviteUserType(type);
    setIsInviteModalOpen(true);
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* Left Sidebar Navigation */}


      {/* Right Main Content Area */}
      <main className="flex-1 min-w-0 overflow-hidden bg-background">
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
                onProjectsChange={handleTableProjectsChange}
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

            {activeNav === "SETTINGS" && (
              userRole === "ADMIN" ? (
                <AdminSettingsView />
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <Shield size={32} className="text-primary mb-2" />
                  <h3 className="text-lg font-bold text-foreground">Managers Only</h3>
                  <p className="text-xs max-w-sm mt-1">
                    You don&apos;t have permission to view or edit workspace settings and project templates.
                  </p>
                </div>
              )
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
