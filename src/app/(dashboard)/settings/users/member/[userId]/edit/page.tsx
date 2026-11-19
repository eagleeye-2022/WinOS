import { auth } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import {
  getAllUserOptionsAction,
  getManagerOptionsAction,
  getUserDetailsAction,
} from "@/features/users/actions/user-actions";
import { MemberForm } from "@/features/users/components/member-form";
import { ProfileView } from "@/features/attendance/components/my-profile-view";
import { canManageAttendance } from "@/features/attendance/utils";
import { PULSE_PAGE_BG } from "@/components/pulse/pulse-ui";

type Props = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ form?: string }>;
};

/**
 * A member in User Management. By default the same profile as Pulse (cover, sections, edit-in-place);
 * `?form=full` opens the full member form, which is still where the photo and documents are uploaded.
 */
export default async function EditMemberPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const { userId } = await params;
  const { form } = await searchParams;
  const userRole = (session.user as { role?: string })?.role ?? "TEAM_MEMBER";
  const isManager = userRole === "MANAGER";
  const isSelf = session.user.id === userId;

  if (!isManager && !isSelf) {
    redirect(ROUTES.dashboard);
  }

  if (form !== "full") {
    return (
      // Padded scroller like the Pulse pages, so the Edit Profile form's pinned Save bar sits flush at the bottom.
      <div className={`flex h-full w-full flex-col overflow-y-auto p-4 sm:p-6 ${PULSE_PAGE_BG}`}>
        <div className="mx-auto mb-4 w-full max-w-[1400px]">
          <Link
            href={isManager ? ROUTES.settingsUsers : ROUTES.dashboard}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {isManager ? "Back to User Management" : "Back to Dashboard"}
          </Link>
        </div>
        {isSelf ? (
          <ProfileView mode="self" canManage={canManageAttendance(session.user)} currentUserId={session.user.id} />
        ) : (
          <ProfileView key={userId} mode="member" userId={userId} />
        )}
      </div>
    );
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
