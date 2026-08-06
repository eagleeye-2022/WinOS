import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { getMyBlockers, getBlockersWithMe } from "@/features/blockers/queries";
import { getTeamMembers } from "@/features/dsm/queries";
import { BlockersClient } from "@/features/blockers/components/blockers-client";

export default async function BlockersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const [items, itemsForMe, teamMembers] = await Promise.all([
    getMyBlockers(),
    getBlockersWithMe(),
    getTeamMembers(),
  ]);

  return (
    <BlockersClient
      items={items}
      itemsForMe={itemsForMe}
      teamMembers={teamMembers}
      currentUserId={session.user.id}
      isManager={session.user.role === "MANAGER"}
    />
  );
}

