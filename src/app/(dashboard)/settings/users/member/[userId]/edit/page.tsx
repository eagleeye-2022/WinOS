import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
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
  if ((session.user as { role?: string })?.role !== "MANAGER") {
    redirect(ROUTES.dashboard);
  }

  const { userId } = await params;

  const [managers, allUsers, initialData] = await Promise.all([
    getManagerOptionsAction(),
    getAllUserOptionsAction(),
    getUserDetailsAction(userId),
  ]);

  if (!initialData) notFound();

  return (
    <MemberForm
      mode="edit"
      userId={userId}
      initialData={initialData}
      managers={managers}
      allUsers={allUsers}
    />
  );
}
