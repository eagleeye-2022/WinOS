"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  getUsersAction,
  inviteUserAction,
  updateUserRoleAction,
  getProjectsAction,
} from "@/features/projects/actions/project-actions";
import { UsersTableView } from "@/features/projects/components/views/users-table-view";
import { InviteMemberModal, InviteFormSubmission } from "@/features/projects/components/modals/invite-member-modal";
import { MemberRoleTier, ProfileRoleValue, Project, ProjectUser, UserType } from "@/features/projects/types";

export default function UsersPage() {
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteUserType, setInviteUserType] = useState<UserType>("PORTAL");

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [fetchedUsers, fetchedProjects] = await Promise.all([
          getUsersAction(),
          getProjectsAction(),
        ]);
        setUsers(fetchedUsers);
        setProjects(fetchedProjects);
      } catch (err) {
        console.error("Failed to load users:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

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
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      <UsersTableView
        users={users}
        onOpenInviteModal={(type) => {
          setInviteUserType(type);
          setIsInviteModalOpen(true);
        }}
        onUpdateUserRole={handleUpdateUserRole}
      />

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        defaultUserType={inviteUserType}
        onInviteUser={async (data) => {
          await handleInviteUser(data);
          setIsInviteModalOpen(false);
        }}
        projects={projects}
        portalUserCount={users.filter((u) => u.userType === "PORTAL").length}
        clientUserCount={users.filter((u) => u.userType === "CLIENT").length}
      />
    </div>
  );
}
