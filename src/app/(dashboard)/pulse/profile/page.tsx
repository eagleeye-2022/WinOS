import { Metadata } from "next";
import { MyProfileView } from "@/features/attendance/components/my-profile-view";
import { PULSE_PAGE_BG } from "@/components/pulse/pulse-ui";

export const metadata: Metadata = {
  title: "My Profile | WinOS",
  description: "View and manage your team member profile, contact details, and account settings.",
};

export default function PulseProfilePage() {
  return (
    <div className={`flex flex-col h-full w-full overflow-y-auto p-4 sm:p-6 select-none ${PULSE_PAGE_BG}`}>
      <MyProfileView />
    </div>
  );
}
