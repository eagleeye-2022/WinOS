import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { getCalendarEvents, getZohoConnectionStatus, getViewRange, CalendarWorkspace } from "@/features/calendar";
import { getWorkspaceUsers } from "@/features/notes";

type Props = {
  searchParams: Promise<{ view?: string; date?: string; connected?: string; error?: string; event?: string }>;
};

export default async function ZohoCalendarPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const sp = await searchParams;
  const params = new URLSearchParams();
  if (sp.view) params.set("view", sp.view);
  if (sp.date) params.set("date", sp.date);
  if (sp.connected) params.set("connected", sp.connected);
  if (sp.error) params.set("error", sp.error);
  if (sp.event) params.set("event", sp.event);

  const query = params.toString();
  redirect(query ? `${ROUTES.calendar}?${query}` : ROUTES.calendar);
}
