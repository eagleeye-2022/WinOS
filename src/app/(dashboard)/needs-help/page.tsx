import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { getHelpRequests } from "@/features/needs-help/queries";
import { NeedsHelpClient } from "@/features/needs-help/components/needs-help-client";

export default async function NeedsHelpPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const items = await getHelpRequests();

  return <NeedsHelpClient items={items} />;
}
