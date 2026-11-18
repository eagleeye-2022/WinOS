import { Metadata } from "next";
import { ROUTES } from "@/constants/routes";
import { requirePulseManagerPage } from "@/features/attendance/page-guards";
import { NewMemberProfileForm } from "@/features/users/components/new-member-profile-form";
import { PULSE_PAGE_BG } from "@/components/pulse/pulse-ui";

export const metadata: Metadata = {
  title: "Add Member | WinOS",
  description: "Add a team member.",
};

/** Add a team member from Pulse (managers), in the same layout as a member's profile. */
export default async function PulseAddMemberPage() {
  await requirePulseManagerPage(ROUTES.pulseHome);
  return (
    <div className={`flex flex-col h-full w-full overflow-y-auto p-4 sm:p-6 select-none ${PULSE_PAGE_BG}`}>
      <NewMemberProfileForm from="pulse" />
    </div>
  );
}
