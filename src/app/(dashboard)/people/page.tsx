import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { canManageAttendance } from "@/features/attendance/utils";
import PeopleWorkspace from "./people-workspace";

export default async function PeoplePage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  return (
    <PeopleWorkspace
      currentUser={{
        id: session.user.id,
        name: session.user.name ?? session.user.email ?? "Unknown User",
        email: session.user.email ?? "",
        // Same manager rule the server applies to these documents.
        role: canManageAttendance(session.user) ? "MANAGER" : "TEAM_MEMBER",
      }}
    />
  );
}
