import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { ProjectsUsersClient } from "./projects-users-client";

export default async function ProjectsUsersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);
  if ((session.user as { role?: string })?.role !== "MANAGER") {
    redirect(ROUTES.dashboard);
  }

  return <ProjectsUsersClient />;
}
