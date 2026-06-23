import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { getMySupportNeeds, getRequestedFromMe } from "@/features/support-needed/queries";
import { getTeamMembers } from "@/features/dsm/queries";
import { SupportClient } from "@/features/support-needed/components/support-client";

export default async function SupportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const [items, itemsForMe, teamMembers] = await Promise.all([
    getMySupportNeeds(),
    getRequestedFromMe(),
    getTeamMembers(),
  ]);

  return (
    <SupportClient
      items={items}
      itemsForMe={itemsForMe}
      teamMembers={teamMembers}
      currentUserId={session.user.id}
      isManager={session.user.role === "MANAGER"}
    />
  );
}
