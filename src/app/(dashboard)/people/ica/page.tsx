import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { db } from "@/lib/db";
import IcaWorkspace from "./ica-workspace";

export default async function IcaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  // Fetch all team members plus the current manager from the database to populate the selector dropdown
  const allUsers = await db.user.findMany({
    where: {
      OR: [
        { role: "TEAM_MEMBER" },
        { id: session.user.id }
      ]
    },
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
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
    title: u.title ?? "Team Member"
  }));

  return (
    <IcaWorkspace
      currentUser={{
        id: session.user.id,
        name: session.user.name ?? session.user.email ?? "Unknown User",
        email: session.user.email ?? "",
        role: session.user.role ?? "TEAM_MEMBER",
      }}
      dbUsers={formattedUsers}
    />
  );
}
