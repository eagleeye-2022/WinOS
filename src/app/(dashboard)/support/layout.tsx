import { requireModuleAccess } from "@/features/users/actions/module-guard";

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("STANDUP");
  return children;
}
