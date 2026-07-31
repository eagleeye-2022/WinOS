import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { getMyBlockers, getBlockersWithMe } from "@/features/blockers/queries";
import { BlockersClient } from "@/features/blockers/components/blockers-client";

export default async function BlockersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const [items, itemsForMe] = await Promise.all([
    getMyBlockers(),
    getBlockersWithMe(),
  ]);

  return (
    <BlockersClient
      items={items}
      itemsForMe={itemsForMe}
      currentUserId={session.user.id}
      isManager={session.user.role === "MANAGER"}
    />
  );
}
