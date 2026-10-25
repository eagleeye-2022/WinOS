import { ProjectChecklistsView } from "@/features/sop-checklists/components/project-checklists-view";

export default async function ChecklistsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  return (
    <div className="flex flex-col h-full min-h-0 w-full bg-background overflow-hidden">
      <ProjectChecklistsView projectId={projectId} />
    </div>
  );
}
