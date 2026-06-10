import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";

export default async function RootPage() {
  const session = await auth();
  if (!session) redirect(ROUTES.login);
  const role = (session.user as { role?: string })?.role;
  redirect(role === "MANAGER" ? ROUTES.dashboard : ROUTES.dsm);
}
