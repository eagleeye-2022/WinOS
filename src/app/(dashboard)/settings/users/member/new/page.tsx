import { auth } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { NewMemberProfileForm } from "@/features/users/components/new-member-profile-form";
import { PULSE_PAGE_BG } from "@/components/pulse/pulse-ui";

/** Add Member in User Management — the same profile-style page as Pulse's Add Member. */
export default async function AddMemberPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);
  const userRole = (session.user as { role?: string })?.role ?? "TEAM_MEMBER";
  if (userRole !== "MANAGER") {
    redirect(ROUTES.dashboard);
  }

  return (
    // Padded scroller like the Pulse page, so the form's pinned Add Member bar sits flush at the bottom.
    <div className={`flex h-full w-full flex-col overflow-y-auto p-4 sm:p-6 ${PULSE_PAGE_BG}`}>
      <div className="mx-auto mb-4 w-full max-w-[1400px]">
        <Link
          href={ROUTES.settingsUsers}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to User Management
        </Link>
      </div>
      <NewMemberProfileForm from="settings" />
    </div>
  );
}
