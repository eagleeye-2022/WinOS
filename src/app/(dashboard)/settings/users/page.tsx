import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import {
  getTeamMembersAction,
  getEmployeeTreeAction,
  getDepartmentTreeAction,
} from "@/features/users/actions/user-actions";
import { TeamWorkspace } from "@/features/users/components/team-workspace";

export default async function SettingsUsersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const [members, employeeTree, departmentTree] = await Promise.all([
    getTeamMembersAction(),
    getEmployeeTreeAction(),
    getDepartmentTreeAction(),
  ]);

  return (
    <TeamWorkspace
      members={members}
      employeeTree={employeeTree}
      departmentTree={departmentTree}
    />
  );
}
