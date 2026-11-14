import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { getPulseHomeData } from "@/features/pulse-home/queries";
import { PulseHomeView } from "@/features/pulse-home/components/pulse-home-view";

export const metadata: Metadata = {
  title: "Home | Pulse | WinOS",
  description: "Your day at a glance: check-in, work schedule, loss of pay, holidays and team presence.",
};

export default async function PulseHomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);

  const data = await getPulseHomeData(session.user.id);
  if (!data) redirect(ROUTES.login);

  return <PulseHomeView data={data} />;
}
