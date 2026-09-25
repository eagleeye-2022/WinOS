import { requireModuleAccess } from "@/features/users/actions/module-guard";

export default async function PeopleLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("PEOPLE");
  return children;
}
