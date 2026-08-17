"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type {
  TeamMemberRow,
  DepartmentOption,
  ManagerOption,
  EmployeeTreeNode,
  DepartmentTreeGroup,
} from "@/features/users/actions/user-actions";
import { TeamTable } from "./team-table";
import { EmployeeTree } from "./employee-tree";
import { DepartmentTree } from "./department-tree";
import { AddMemberForm } from "./add-member-form";
import { UserProfileCard } from "./user-profile-card";

interface TeamWorkspaceProps {
  members: TeamMemberRow[];
  departments: DepartmentOption[];
  managers: ManagerOption[];
  employeeTree: EmployeeTreeNode[];
  departmentTree: DepartmentTreeGroup[];
}

export function TeamWorkspace({
  members,
  departments,
  managers,
  employeeTree,
  departmentTree,
}: TeamWorkspaceProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const profileUser = members.find((m) => m.id === profileUserId) || null;

  return (
    <div className="p-6">
      <Tabs defaultValue="my-team">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="my-team">My Team</TabsTrigger>
            <TabsTrigger value="employee-tree">Employee Tree</TabsTrigger>
            <TabsTrigger value="department-tree">Department Tree</TabsTrigger>
          </TabsList>

          <Button onClick={() => setIsAddOpen(true)} className="gap-1.5">
            <Plus size={16} />
            Add Member
          </Button>
        </div>

        <TabsContent value="my-team" className="mt-0">
          <TeamTable
            members={members}
            departments={departments}
            managers={managers}
            onSelectUser={setProfileUserId}
          />
        </TabsContent>

        <TabsContent value="employee-tree" className="mt-0">
          <EmployeeTree nodes={employeeTree} onSelectUser={setProfileUserId} />
        </TabsContent>

        <TabsContent value="department-tree" className="mt-0">
          <DepartmentTree groups={departmentTree} onSelectUser={setProfileUserId} />
        </TabsContent>
      </Tabs>

      <AddMemberForm
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        departments={departments}
        managers={managers}
      />

      <UserProfileCard
        member={profileUser}
        onClose={() => setProfileUserId(null)}
      />
    </div>
  );
}
