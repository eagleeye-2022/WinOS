"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PermissionModuleView, UserModuleAccessView } from "@/features/users/actions/permission-actions";
import { PermissionMatrix } from "./permission-matrix";
import { UserModuleAccessTable } from "./user-module-access-table";

interface PermissionAccessWorkspaceProps {
  userModules: PermissionModuleView[];
  clientModules: PermissionModuleView[];
  systemModules: PermissionModuleView[];
  userModuleAccess: UserModuleAccessView;
}

export function PermissionAccessWorkspace({
  userModules,
  clientModules,
  systemModules,
  userModuleAccess,
}: PermissionAccessWorkspaceProps) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <Tabs defaultValue="access">
        <TabsList className="mb-4">
          <TabsTrigger value="access">User Access</TabsTrigger>
          {/* <TabsTrigger value="user">User Profile</TabsTrigger> */}
          {/* <TabsTrigger value="client">Client Profile</TabsTrigger> */}
          {/* <TabsTrigger value="system">System Profile</TabsTrigger> */}
        </TabsList>

        <TabsContent value="access" className="mt-0">
          <UserModuleAccessTable data={userModuleAccess} />
        </TabsContent>
        {/* <TabsContent value="user" className="mt-0">
          <PermissionMatrix profileType="USER" modules={userModules} />
        </TabsContent> */}
        {/* <TabsContent value="client" className="mt-0">
          <PermissionMatrix profileType="CLIENT" modules={clientModules} />
        </TabsContent> */}
        {/* <TabsContent value="system" className="mt-0">
          <PermissionMatrix profileType="SYSTEM" modules={systemModules} />
        </TabsContent> */}
      </Tabs>
    </div>
  );
}
