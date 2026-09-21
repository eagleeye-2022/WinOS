import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { getModuleAccessMapAction } from "@/features/users/actions/permission-actions";

export type GuardedModuleKey = "STANDUP" | "PROJECTS" | "USER_MANAGEMENT";

// Synchronous, server-side module gate — call from a layout/page before any
// content renders, so a restricted user never sees a flash of the page
// before being redirected (unlike a client-side check running in an effect
// after mount). Managers bypass this: they're the ones who grant module
// access from Profile Access, so gating them risks locking a manager out of
// the page that would let them undo it.
export async function requireModuleAccess(moduleKey: GuardedModuleKey): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect(ROUTES.login);

  const role = (session!.user as { role?: string })?.role;
  if (role === "MANAGER") return;

  const { accessByUser } = await getModuleAccessMapAction();
  const allowed = accessByUser[userId]?.[moduleKey] ?? true;
  if (!allowed) {
    redirect(`${ROUTES.restricted}?module=${moduleKey}`);
  }
}
