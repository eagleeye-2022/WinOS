"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import type {
  TeamMemberRow,
  EmployeeTreeNode,
  DepartmentTreeGroup,
} from "@/features/users/actions/user-actions";
import { TeamTable } from "./team-table";
import { EmployeeTree } from "./employee-tree";
import { DepartmentTree } from "./department-tree";
import { UserProfileCard } from "./user-profile-card";

interface TeamWorkspaceProps {
  members: TeamMemberRow[];
  employeeTree: EmployeeTreeNode[];
  departmentTree: DepartmentTreeGroup[];
}

export function TeamWorkspace({
  members,
  employeeTree,
  departmentTree,
}: TeamWorkspaceProps) {
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const profileUser = members.find((m) => m.id === profileUserId) || null;

  return (
    <div className="p-6 w-full pb-8">
      <Tabs defaultValue="my-team">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="my-team">My Team</TabsTrigger>
            <TabsTrigger value="employee-tree">Organization Tree</TabsTrigger>
            <TabsTrigger value="department-tree">Department Tree</TabsTrigger>
          </TabsList>

          <Button asChild className="gap-1.5">
            <Link href={ROUTES.settingsUsersNew}>
              <Plus size={16} />
              Add Member
            </Link>
          </Button>
        </div>

        <TabsContent value="my-team" className="mt-0">
          <TeamTable members={members} onSelectUser={setProfileUserId} />
        </TabsContent>

        <TabsContent value="employee-tree" className="mt-0">
          <EmployeeTree nodes={employeeTree} onSelectUser={setProfileUserId} />
        </TabsContent>

        <TabsContent value="department-tree" className="mt-0">
          <DepartmentTree groups={departmentTree} onSelectUser={setProfileUserId} />
        </TabsContent>
      </Tabs>

      <UserProfileCard
        member={profileUser}
        onClose={() => setProfileUserId(null)}
      />
    </div>
  );
}
