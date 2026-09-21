import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import {
  getTeamMembersAction,
  getEmployeeTreeAction,
  getDepartmentTreeAction,
  getModuleAccessColumnsAction,
} from "@/features/users/actions/user-actions";
import { TeamWorkspace } from "@/features/users/components/team-workspace";

export default async function SettingsUsersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);
  if ((session.user as { role?: string })?.role !== "MANAGER") {
    redirect(ROUTES.dashboard);
  }

  const [members, employeeTree, departmentTree, moduleColumns] = await Promise.all([
    getTeamMembersAction(),
    getEmployeeTreeAction(),
    getDepartmentTreeAction(),
    getModuleAccessColumnsAction(),
  ]);

  return (
    <TeamWorkspace
      members={members}
      employeeTree={employeeTree}
      departmentTree={departmentTree}
      moduleColumns={moduleColumns}
    />
  );
}
