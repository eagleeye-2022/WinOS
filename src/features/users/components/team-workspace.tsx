"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import type {
  TeamMemberRow,
  EmployeeTreeNode,
  DepartmentTreeGroup,
  ModuleAccessColumn,
} from "@/features/users/actions/user-actions";
import { TeamTable } from "./team-table";
import { EmployeeTree } from "./employee-tree";
import { DepartmentTree } from "./department-tree";
import { UserProfileCard } from "./user-profile-card";
import { useUrlState } from "@/lib/navigation/use-url-state";

const WORKSPACE_TABS = ["my-team", "employee-tree", "department-tree"] as const;
type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

interface TeamWorkspaceProps {
  members: TeamMemberRow[];
  employeeTree: EmployeeTreeNode[];
  departmentTree: DepartmentTreeGroup[];
  moduleColumns: ModuleAccessColumn[];
}

export function TeamWorkspace({
  members,
  employeeTree,
  departmentTree,
  moduleColumns,
}: TeamWorkspaceProps) {
  // Tab and the open profile card live in the URL so they're restored when returning here.
  const [tab, setTab] = useUrlState<WorkspaceTab>("tab", "my-team", { allowed: WORKSPACE_TABS, history: "push" });
  const [profileParam, setProfileParam] = useUrlState("member", "", { history: "push" });
  const setProfileUserId = (id: string | null) => setProfileParam(id ?? "");

  const profileUser = members.find((m) => m.id === profileParam) || null;

  return (
    <div className="h-full w-full overflow-y-auto p-6 pb-8">
      <Tabs value={tab} onValueChange={(value) => setTab(value as WorkspaceTab)}>
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
          <TeamTable members={members} moduleColumns={moduleColumns} onSelectUser={setProfileUserId} />
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
