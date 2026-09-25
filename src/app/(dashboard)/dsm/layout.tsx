import { requireModuleAccess } from "@/features/users/actions/module-guard";

export default async function DsmLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("STANDUP");
  return children;
}
