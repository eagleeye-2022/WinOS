import { requireModuleAccess } from "@/features/users/actions/module-guard";

export default async function BlockersLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("STANDUP");
  return children;
}
