import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { getPermissionMatrixAction } from "@/features/users/actions/permission-actions";
import { PermissionAccessWorkspace } from "@/features/users/components/permission-access-workspace";

export default async function ProfileAccessPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const [userModules, clientModules, systemModules] = await Promise.all([
    getPermissionMatrixAction("USER"),
    getPermissionMatrixAction("CLIENT"),
    getPermissionMatrixAction("SYSTEM"),
  ]);

  return (
    <PermissionAccessWorkspace
      userModules={userModules}
      clientModules={clientModules}
      systemModules={systemModules}
    />
  );
}
