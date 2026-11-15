import { auth } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import {
  getAllUserOptionsAction,
  getManagerOptionsAction,
  getUserDetailsAction,
} from "@/features/users/actions/user-actions";
import { MemberForm } from "@/features/users/components/member-form";

type Props = {
  params: Promise<{ userId: string }>;
};

export default async function EditMemberPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const { userId } = await params;
  const userRole = (session.user as { role?: string })?.role ?? "TEAM_MEMBER";
  const isManager = userRole === "MANAGER";
  const isSelf = session.user.id === userId;

  if (!isManager && !isSelf) {
    redirect(ROUTES.dashboard);
  }

  const [managers, allUsers, initialData] = await Promise.all([
    getManagerOptionsAction(),
    getAllUserOptionsAction(),
    getUserDetailsAction(userId),
  ]);

  // No user with this id (deleted, or a link from another database) — explain it instead of a bare 404.
  if (!initialData) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="max-w-md space-y-3 rounded-lg border border-border/70 bg-card p-6 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h1 className="text-lg font-semibold text-foreground">Member not found</h1>
          <p className="text-sm text-muted-foreground">
            There&apos;s no team member with this ID. They may have been removed, or the link is out of date.
          </p>
          <p className="break-all font-mono text-xs text-muted-foreground">{userId}</p>
          <div className="flex justify-center gap-2 pt-1">
            {isManager && (
              <Link
                href={ROUTES.settingsUsers}
                className="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Go to User Management
              </Link>
            )}
            <Link
              href={ROUTES.settingsUsersEdit(session.user.id)}
              className="inline-flex h-9 items-center rounded-md border border-border/80 px-4 text-xs font-semibold text-foreground hover:bg-accent"
            >
              My profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MemberForm
      mode="edit"
      userId={userId}
      initialData={initialData}
      managers={managers}
      allUsers={allUsers}
      currentUserRole={userRole}
      currentUserId={session.user.id}
    />
  );
}
