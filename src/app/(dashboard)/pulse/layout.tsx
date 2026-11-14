import { requireModuleAccess } from "@/features/users/actions/module-guard";
import { PulseNavShell } from "@/components/pulse/pulse-breadcrumbs";

export default async function PulseLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("PEOPLE");
  return <PulseNavShell>{children}</PulseNavShell>;
}
