import { requireModuleAccess } from "@/features/users/actions/module-guard";

export default async function NeedsHelpLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("STANDUP");
  return children;
}
