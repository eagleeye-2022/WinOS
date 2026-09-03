import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import {
  getAllUserOptionsAction,
  getManagerOptionsAction,
} from "@/features/users/actions/user-actions";
import { MemberForm } from "@/features/users/components/member-form";

export default async function AddMemberPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);
  const userRole = (session.user as { role?: string })?.role ?? "TEAM_MEMBER";
  if (userRole !== "MANAGER") {
    redirect(ROUTES.dashboard);
  }

  const [managers, allUsers] = await Promise.all([
    getManagerOptionsAction(),
    getAllUserOptionsAction(),
  ]);

  return (
    <MemberForm
      mode="create"
      managers={managers}
      allUsers={allUsers}
      currentUserRole={userRole}
      currentUserId={session.user.id}
    />
  );
}
