import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);
  if ((session.user as { role?: string })?.role !== "MANAGER") {
    redirect(ROUTES.dashboard);
  }
  redirect(ROUTES.settingsUsers);
}
