"use server";

import { signOut } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";

export async function logoutAction() {
  await signOut({ redirectTo: ROUTES.login });
}
