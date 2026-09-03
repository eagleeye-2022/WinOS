"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import {
  getUsersAction,
  inviteUserAction,
  updateUserRoleAction,
  getProjectsAction,
} from "@/features/projects/actions/project-actions";
import {
  getClientInvitationsAction,
  ClientInvitationListItem,
} from "@/features/projects/actions/client-invitation-actions";
import { UsersTableView } from "@/features/projects/components/views/users-table-view";
import { InviteMemberModal, InviteFormSubmission } from "@/features/projects/components/modals/invite-member-modal";
import { InviteClientModal } from "@/features/projects/components/modals/invite-client-modal";
import { MemberRoleTier, ProfileRoleValue, Project, ProjectUser, UserType } from "@/features/projects/types";

export function ProjectsUsersClient() {
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [invitations, setInvitations] = useState<ClientInvitationListItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteMemberOpen, setIsInviteMemberOpen] = useState(false);
  const [isInviteClientOpen, setIsInviteClientOpen] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersRes, projectsRes, invitationsRes] = await Promise.allSettled([
        getUsersAction(),
        getProjectsAction(),
        getClientInvitationsAction(),
      ]);
      if (usersRes.status === "fulfilled") setUsers(usersRes.value);
      if (projectsRes.status === "fulfilled") setProjects(projectsRes.value);
      if (invitationsRes.status === "fulfilled") setInvitations(invitationsRes.value);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const handleInviteUser = async (data: InviteFormSubmission) => {
    const newUser = await inviteUserAction(
      data.email,
      data.name,
      data.role,
      "Development",
      undefined,
      data.projectIds
    );
    setUsers((prev) => [newUser, ...prev]);
  };

  const handleUpdateUserRole = async (
    userId: string,
    role: MemberRoleTier,
    profileRole: ProfileRoleValue
  ) => {
    const updatedUser = await updateUserRoleAction(userId, role, profileRole);
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      <UsersTableView
        users={users}
        invitations={invitations}
        onOpenInviteModal={(type) => {
          if (type === "CLIENT") {
            setIsInviteClientOpen(true);
          } else {
            setIsInviteMemberOpen(true);
          }
        }}
        onUpdateUserRole={handleUpdateUserRole}
        onRefreshData={loadData}
      />

      <InviteMemberModal
        isOpen={isInviteMemberOpen}
        onClose={() => setIsInviteMemberOpen(false)}
        defaultUserType="PORTAL"
        onInviteUser={async (data) => {
          await handleInviteUser(data);
          setIsInviteMemberOpen(false);
        }}
        projects={projects}
        portalUserCount={users.filter((u) => u.userType === "PORTAL").length}
        clientUserCount={users.filter((u) => u.userType === "CLIENT").length}
      />

      <InviteClientModal
        isOpen={isInviteClientOpen}
        onClose={() => setIsInviteClientOpen(false)}
        projects={projects}
        onSuccess={loadData}
      />
    </div>
  );
}

