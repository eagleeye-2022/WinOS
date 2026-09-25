import { requireModuleAccess } from "@/features/users/actions/module-guard";

export default async function LeaveLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("PEOPLE");
  return children;
}
