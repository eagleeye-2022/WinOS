import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type AuthUserSession = {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  profileRole?: string;
};

export async function requireAuthenticatedUser(): Promise<AuthUserSession> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized: Please log in to access this resource.");
  }
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    role: (session.user as { role?: string }).role,
    profileRole: (session.user as { profileRole?: string }).profileRole,
  };
}

export async function requireProjectAccess(projectId: string): Promise<{
  user: AuthUserSession;
  isClient: boolean;
}> {
  const user = await requireAuthenticatedUser();

  // Internal Admins & Managers have global access to projects
  if (user.role === "MANAGER" || user.profileRole === "ADMIN" || user.profileRole === "PORTAL_OWNER") {
    return { user, isClient: false };
  }

  // Verify ProjectMember record with ACTIVE status
  const membership = await db.projectMember.findFirst({
    where: {
      projectId,
      userId: user.id,
      status: "ACTIVE",
    },
  });

  if (!membership) {
    throw new Error("Forbidden: You do not have access to this project.");
  }

  const isClient = user.profileRole === "CLIENT";
  return { user, isClient };
}

export async function requireInternalUser(): Promise<AuthUserSession> {
  const user = await requireAuthenticatedUser();
  if (user.profileRole === "CLIENT") {
    throw new Error("Forbidden: This action is restricted to internal team members.");
  }
  return user;
}

export async function requireClientUser(): Promise<AuthUserSession> {
  const user = await requireAuthenticatedUser();
  if (user.profileRole !== "CLIENT") {
    throw new Error("Forbidden: This portal is reserved for client accounts.");
  }
  return user;
}
