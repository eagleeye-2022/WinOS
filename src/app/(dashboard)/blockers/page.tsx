import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { getMyBlockers } from "@/features/blockers/queries";
import { BlockersClient } from "@/features/blockers/components/blockers-client";

export default async function BlockersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const items = await getMyBlockers();

  return (
    <BlockersClient
      items={items}
      currentUserId={session.user.id}
      isManager={session.user.role === "MANAGER"}
    />
  );
}
