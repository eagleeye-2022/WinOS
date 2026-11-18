import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { ProfileView } from "@/features/attendance/components/my-profile-view";
import { requirePulseManagerPage } from "@/features/attendance/page-guards";
import { PULSE_PAGE_BG } from "@/components/pulse/pulse-ui";

export const metadata: Metadata = {
  title: "Team Member Profile | WinOS",
  description: "A team member's profile, attendance and leave.",
};

/** A manager's view of someone else's profile, with their Attendance and Leave as tabs. */
export default async function PulseMemberProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  await requirePulseManagerPage(ROUTES.pulseProfile);
  const session = await auth();
  const { userId } = await params;
  // Your own id → your own profile (status pill, log out, personal attendance/leave).
  if (userId === session?.user?.id) redirect(ROUTES.pulseProfile);

  // Every manager here can edit the profile (inline, or with "Edit Profile" — both stay on this page).
  return (
    <div className={`flex flex-col h-full w-full overflow-y-auto p-4 sm:p-6 select-none ${PULSE_PAGE_BG}`}>
      <ProfileView key={userId} mode="member" userId={userId} />
    </div>
  );
}
