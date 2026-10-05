import { Metadata } from "next";
import { MyProfileView } from "@/features/attendance/components/my-profile-view";

export const metadata: Metadata = {
  title: "My Profile | WinOS",
  description: "View and manage your employee profile, contact details, and account settings.",
};

export default function PulseProfilePage() {
  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-background/50 p-6 select-none">
      <MyProfileView />
    </div>
  );
}
