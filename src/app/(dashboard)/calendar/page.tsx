import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { getCalendarEvents, getZohoConnectionStatus, getViewRange, CalendarWorkspace } from "@/features/calendar";
import { getWorkspaceUsers } from "@/features/notes";

type Props = {
  searchParams: Promise<{ view?: string; date?: string; connected?: string; error?: string; event?: string }>;
};

export default async function CalendarPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const sp = await searchParams;
  const connectionStatus = await getZohoConnectionStatus();

  const view = sp.view === "month" ? "month" : "week";
  const anchorDate = sp.date ? new Date(sp.date) : new Date();

  const { rangeStart, rangeEnd } = getViewRange(view, anchorDate);

  const [events, users] = await Promise.all([
    getCalendarEvents(rangeStart, rangeEnd),
    getWorkspaceUsers(),
  ]);

  return (
    <CalendarWorkspace
      events={events}
      connectionStatus={connectionStatus}
      internalUsers={users}
      view={view}
      anchorDateIso={anchorDate.toISOString()}
      currentUserId={session.user.id}
      currentUserEmail={session.user.email ?? ""}
      connectedBanner={sp.connected === "1"}
      errorBanner={sp.error}
      focusEventId={sp.event}
    />
  );
}
