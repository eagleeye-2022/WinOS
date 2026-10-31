import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { db } from "@/lib/db";
import { canManageAttendance } from "@/features/attendance/utils";
import { managedUserIds } from "@/features/attendance/team-scope";
import IcaWorkspace from "./ica-workspace";

export default async function IcaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  // Selector dropdown: only the people this user may open — themselves, plus their team if a manager.
  const viewer = { ...session.user, id: session.user.id };
  const scope = await managedUserIds(viewer);
  const allUsers = await db.user.findMany({
    where: scope === null ? undefined : { id: { in: [viewer.id, ...scope] } },
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
      role: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  // Map users to ensure name is populated with email if name is null
  const formattedUsers = allUsers.map(u => ({
    id: u.id,
    name: u.name ?? u.email,
    email: u.email,
    title: u.title ?? (u.role === "MANAGER" ? "Manager" : "Team Member"),
    role: u.role,
  }));

  return (
    <IcaWorkspace
      currentUser={{
        id: session.user.id,
        name: session.user.name ?? session.user.email ?? "Unknown User",
        email: session.user.email ?? "",
        role: canManageAttendance(session.user) ? "MANAGER" : "TEAM_MEMBER",
      }}
      dbUsers={formattedUsers}
    />
  );
}
