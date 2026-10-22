import { Shield } from "lucide-react";
import { SopLibraryView } from "@/features/sop-checklists/components/sop-library-view";
import { getCurrentUserRoleAction } from "@/features/projects/actions/project-actions";

export default async function SopChecklistsPage() {
  const role = await getCurrentUserRoleAction();

  if (role !== "ADMIN") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 bg-background p-8 text-center text-muted-foreground">
        <Shield size={32} className="text-primary" />
        <h3 className="text-lg font-bold text-foreground">Managers Only</h3>
        <p className="max-w-sm text-xs">
          Only managers can create and manage SOP checklists. You&apos;ll find the checklists attached to your
          tasks on each task&apos;s SOP Checklist tab.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 w-full bg-background overflow-hidden">
      <SopLibraryView />
    </div>
  );
}
