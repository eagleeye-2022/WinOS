import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { ProfileView } from "@/features/attendance/components/my-profile-view";
import { canManageAttendance } from "@/features/attendance/utils";
import { PULSE_PAGE_BG } from "@/components/pulse/pulse-ui";

export const metadata: Metadata = {
  title: "My Profile | WinOS",
  description: "View and manage your team member profile, contact details, and account settings.",
};

export default async function PulseProfilePage() {
  const session = await auth();
  return (
    <div className={`flex flex-col h-full w-full overflow-y-auto p-4 sm:p-6 select-none ${PULSE_PAGE_BG}`}>
      <ProfileView mode="self" canManage={canManageAttendance(session?.user)} currentUserId={session?.user?.id} />
    </div>
  );
}
