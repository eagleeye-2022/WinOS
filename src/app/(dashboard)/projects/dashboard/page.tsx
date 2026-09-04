import { Suspense } from "react";
import { MyProjectsDashboardWorkspace } from "@/features/projects/components/my-projects-dashboard-workspace";

export default function ProjectsDashboardPage() {
  return (
    <Suspense fallback={null}>
      <MyProjectsDashboardWorkspace />
    </Suspense>
  );
}
