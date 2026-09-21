import { requireModuleAccess } from "@/features/users/actions/module-guard";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("USER_MANAGEMENT");
  return children;
}
