import { SopLibraryView } from "@/features/sop-checklists/components/sop-library-view";
import { getCurrentUserRoleAction } from "@/features/projects/actions/project-actions";

/**
 * Srijan → SOPs/Checklists. Managers create and edit SOPs here; team members get the same library
 * read-only (browse, search and read every SOP) — the server actions enforce the same split.
 */
export default async function SopChecklistsPage() {
  const role = await getCurrentUserRoleAction();

  return (
    <div className="flex flex-col h-full min-h-0 w-full bg-background overflow-hidden">
      <SopLibraryView canEdit={role === "ADMIN"} />
    </div>
  );
}
