"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PermissionModuleView } from "@/features/users/actions/permission-actions";
import { PermissionMatrix } from "./permission-matrix";

interface PermissionAccessWorkspaceProps {
  userModules: PermissionModuleView[];
  clientModules: PermissionModuleView[];
  systemModules: PermissionModuleView[];
}

export function PermissionAccessWorkspace({
  userModules,
  clientModules,
  systemModules,
}: PermissionAccessWorkspaceProps) {
  return (
    <div className="p-6">
      <Tabs defaultValue="user">
        <TabsList className="mb-4">
          <TabsTrigger value="user">User Profile</TabsTrigger>
          <TabsTrigger value="client">Client Profile</TabsTrigger>
          <TabsTrigger value="system">System Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="user" className="mt-0">
          <PermissionMatrix profileType="USER" modules={userModules} />
        </TabsContent>
        <TabsContent value="client" className="mt-0">
          <PermissionMatrix profileType="CLIENT" modules={clientModules} />
        </TabsContent>
        <TabsContent value="system" className="mt-0">
          <PermissionMatrix profileType="SYSTEM" modules={systemModules} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
