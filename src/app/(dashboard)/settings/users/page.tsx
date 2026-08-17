import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import {
  getTeamMembersAction,
  getDepartmentOptionsAction,
  getManagerOptionsAction,
  getEmployeeTreeAction,
  getDepartmentTreeAction,
} from "@/features/users/actions/user-actions";
import { TeamWorkspace } from "@/features/users/components/team-workspace";

export default async function SettingsUsersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const [members, departments, managers, employeeTree, departmentTree] = await Promise.all([
    getTeamMembersAction(),
    getDepartmentOptionsAction(),
    getManagerOptionsAction(),
    getEmployeeTreeAction(),
    getDepartmentTreeAction(),
  ]);

  return (
    <TeamWorkspace
      members={members}
      departments={departments}
      managers={managers}
      employeeTree={employeeTree}
      departmentTree={departmentTree}
    />
  );
}
