import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { getModuleAccessMapAction } from "@/features/users/actions/permission-actions";

export type GuardedModuleKey = "STANDUP" | "PROJECTS" | "USER_MANAGEMENT" | "PEOPLE";

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

// Non-redirecting counterpart for Server Actions/queries (e.g. DSM actions
// that read Projects data) — callers decide what to return when access is
// denied instead of navigating the user away mid-action. Same MANAGER bypass
// as requireModuleAccess, for the same reason.
export async function hasModuleAccess(moduleKey: GuardedModuleKey): Promise<boolean> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return false;

  const role = (session.user as { role?: string })?.role;
  if (role === "MANAGER") return true;

  const { accessByUser } = await getModuleAccessMapAction();
  return accessByUser[userId]?.[moduleKey] ?? true;
}
