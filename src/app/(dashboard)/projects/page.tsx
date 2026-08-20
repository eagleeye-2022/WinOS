import { Suspense } from "react";
import { ProjectsWorkspace } from "@/features/projects/components/projects-workspace";

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsWorkspace />
    </Suspense>
  );
}
