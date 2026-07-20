import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";

export default async function MemberNotesIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);
  redirect(`/notes/member/${session.user.id}`);
}
