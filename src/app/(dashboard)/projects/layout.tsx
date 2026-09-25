import { requireModuleAccess } from "@/features/users/actions/module-guard";

export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("PROJECTS");
  return children;
}
