"use server";

import { auth, signOut } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";

export async function logoutAction() {
  const session = await auth();
  const profileRole = (session?.user as { profileRole?: string } | undefined)?.profileRole;
  await signOut({
    redirectTo: profileRole === "CLIENT" ? ROUTES.clientLogin : ROUTES.login,
  });
}
